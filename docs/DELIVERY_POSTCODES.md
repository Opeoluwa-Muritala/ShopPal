# Delivery postcode registry

Delivery defaults to Ilorin, Kwara, Nigeria. The customer supplies one full
address; another city/state in that address takes precedence. WhatsApp supplies
the phone number. Bumpa online checkout still requires a name and email.

The small registry in `backend/app/services/delivery_postcodes.py` contains
legacy six-digit delivery codes. It matches named areas/streets, not Ilorin as
a whole. Multiple conflicting matches return no postcode. A postcode supplied
by the customer takes precedence.

| Address match | Legacy postcode |
| --- | --- |
| Taiwo Road / Taiwo Rd | 240241 |
| Adewole Estate | 240243 |
| Gaa Akanbi | 240222 |
| Baboko | 240232 |

The entries were cross-checked against the
[Ilorin directory](https://nigeriapostalcodes.com/ilorin-city-post-codes-zip-codes-kwara-state.html)
and [Nigeria Postal directory](https://nigeriapostal.com/search?page=5&postlocations=Ilorin&search=search).
These are third-party directories, not a NIPOST-verified building lookup.
Do not register bare "Tanke": published directories disagree between rural
and urban locations sharing that name.

[NIPOST's digital postcode service](https://www.postcode.gov.ng/) now describes
an 11-character building postcode. A customer-supplied digital postcode is
accepted, but none is inferred from these area codes.

TODO(BUMPA_OPTIONAL_POSTCODE): verify on staging whether shipping accepts an
empty `zip` and which postcode format Bumpa expects. Until then, unmatched
addresses send an empty postcode, never an invented one. If Bumpa returns a
postcode validation error, ask for the postcode and retry only after the
customer provides it. All address fields remain temporary process memory.
