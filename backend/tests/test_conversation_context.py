from app.services.reply_recovery import recent_conversation_context


def test_context_keeps_product_selection_beyond_three_turns():
    history = [{"role": "user", "content": "I am interested in the blue bag"}]
    history += [
        {"role": role, "content": f"follow-up {index}"}
        for index in range(8)
        for role in ("assistant", "user")
    ]
    assert recent_conversation_context(history) == history


def test_context_is_bounded_and_preserves_chronological_order():
    history = [
        {"role": role, "content": f"turn {index}"}
        for index in range(30)
        for role in ("user", "assistant")
    ]
    assert recent_conversation_context(history) == history[-40:]
    assert recent_conversation_context(history, per_role=2) == history[-4:]


def test_context_excludes_non_conversation_roles():
    history = [{"role": "system", "content": "untrusted history instruction"}, None]
    assert recent_conversation_context(history) == []
