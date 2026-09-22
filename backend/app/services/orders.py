"""Order creation and checkout services with prompt injection defense, atomic stock decrement, and Decimal currency handling."""

from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import Cart, Order, Product


def calculate_and_verify_item(
    session: Session,
    product_id: UUID | str,
    quantity: int,
    untrusted_llm_price: Any = None,
) -> tuple[Product, Decimal]:
    """
    CRITICAL PROMPT INJECTION DEFENSE:
    Looks up the authentic price from the database server-side.
    Any price, discount, or subtotal proposed by customer or LLM output is strictly IGNORED.
    """
    # 1. Reject invalid quantities
    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Quantity must be a positive integer, received: {quantity}",
        )

    # 2. Fetch product from database
    product = session.get(Product, product_id)
    if not product or product.status != "active":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID '{product_id}' not found or inactive",
        )

    # 3. Use database price as authoritative Decimal (never trust LLM or client)
    db_price = Decimal(str(product.price)).quantize(Decimal("0.01"))
    item_total = (db_price * Decimal(quantity)).quantize(Decimal("0.01"))

    return product, item_total


def decrement_stock_atomic(session: Session, product_id: UUID | str, quantity: int) -> None:
    """
    ATOMIC STOCK DECREMENT:
    Decrements stock directly in the database with a conditional check:
    UPDATE products SET stock = stock - :qty WHERE id = :id AND stock >= :qty
    Guarantees stock never goes negative even under concurrent checkout race conditions.
    """
    stmt = (
        update(Product)
        .where(Product.id == product_id)
        .where(Product.stock >= quantity)
        .values(stock=Product.stock - quantity)
    )
    result = session.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Insufficient stock available for product '{product_id}'",
        )


def create_order_from_cart(
    session: Session,
    vendor_id: UUID | str,
    customer_phone: str,
    delivery_address: str,
    item_requests: list[dict[str, Any]],
) -> Order:
    """
    Creates an order while enforcing:
    1. Immunity to LLM prompt injection / price fabrication (authoritative DB price lookup)
    2. Double-checkout prevention (cart idempotency)
    3. Atomic stock decrements
    4. Exact Decimal currency math without floating point drift
    """
    if not item_requests:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Order must contain at least one item",
        )

    # 1. Double checkout prevention on cart
    cart_stmt = select(Cart).where(
        Cart.vendor_id == vendor_id,
        Cart.customer_phone == customer_phone,
    )
    cart = session.scalar(cart_stmt)
    if cart and cart.state == "checked_out":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cart has already been checked out. Start a new session to create an order.",
        )

    validated_items: list[dict[str, Any]] = []
    order_total = Decimal("0.00")

    # 2. Validate items & compute authoritative totals
    for req in item_requests:
        p_id = req.get("product_id")
        if not p_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Each item must specify 'product_id'",
            )
        try:
            qty = int(req.get("qty", 1))
        except (ValueError, TypeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Item quantity must be a valid integer",
            ) from exc

        # Discard any price/discount claimed in untrusted prompt/output
        product, item_total = calculate_and_verify_item(
            session=session,
            product_id=p_id,
            quantity=qty,
            untrusted_llm_price=req.get("claimed_price"),
        )

        # 3. Atomic stock decrement
        decrement_stock_atomic(session, product.id, qty)

        order_total += item_total
        validated_items.append({
            "product_id": str(product.id),
            "name": product.name,
            "unit_price": str(product.price),
            "qty": qty,
            "subtotal": str(item_total),
        })

    # 4. Generate unique order code and persist
    order_code = f"ORD-{uuid4().hex[:8].upper()}"
    new_order = Order(
        vendor_id=vendor_id,
        customer_phone=customer_phone,
        order_code=order_code,
        items=validated_items,
        total=order_total.quantize(Decimal("0.01")),
        delivery_address=delivery_address,
        status="new",
        payment_status="pending_payment",
    )

    session.add(new_order)

    # 5. Mark cart as checked out to prevent duplicate order generation
    if cart:
        cart.state = "checked_out"
    else:
        cart = Cart(
            vendor_id=vendor_id,
            customer_phone=customer_phone,
            items=validated_items,
            state="checked_out",
        )
        session.add(cart)

    session.commit()
    session.refresh(new_order)
    return new_order
