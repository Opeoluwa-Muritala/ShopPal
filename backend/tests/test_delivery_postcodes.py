import pytest

from app.services.bumpa_assistant import local_delivery_address
from app.services.delivery_postcodes import registered_postcode, supplied_postcode


@pytest.mark.parametrize("address,code", [
    ("12 Taiwo Rd., Ilorin", "240241"), ("Adewole Estate near the junction", "240243"),
    ("Gaa Akanbi", "240222"), ("Baboko Ilorin", "240232"),
    ("Unknown road", None), ("Tanke", None), ("Taiwo Road by Baboko", None),
])
def test_registered_postcodes_match_named_areas_without_guessing(address, code):
    assert registered_postcode(address, "Ilorin", "Kwara") == code
    assert registered_postcode(address, "Lagos", "Lagos") is None


def test_supplied_postcode_and_location_take_precedence():
    assert supplied_postcode("12 Road, postcode: 240999") == "240999"
    assert supplied_postcode("12 Road, Ilorin") is None
    assert local_delivery_address("12 Road, Lagos, Lagos") == {
        "street": "12 Road", "city": "Lagos", "state": "Lagos", "country": "Nigeria",
    }
    assert local_delivery_address("12 Road, Jos")["state"] == ""
