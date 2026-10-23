# Integration evidence and service boundaries

Checked 23 October 2026.

| Path | External interaction | Outcome |
|---|---|---|
| Live journeys | HTTPS GET to the documented TfL Unified API, using public station IDs and routing preferences | Real journey information; no ticket, payment, or reservation |
| Local route save | Laptop SQLite only | Saved reminder; a fresh check is required before travel |
| Read aloud | Offline Android voice where available; otherwise macOS synthesis locally or Linux eSpeak NG on the Azure VM, with native Android audio playback | Spoken guidance; no paid speech service |
| Booking lab | Playwright browser actions against this project's independent fictional provider | Stored reference reservation and verified receipt; no real transport booking |
| Observation tool | SQLite on the active laptop/Azure service and deliberate JSON download | Self, human, and automated observations remain distinct |

TfL's portal documents anonymous access at 50 requests per minute. This prototype caps fresh upstream requests at twelve per minute, coalesces identical concurrent requests, caches successful replies for one minute, and stops serving a stale fallback after five minutes. Responses have a 25-second timeout. It does not poll TfL in the background or send the passenger's name or pickup address.

Sources:

- [TfL products and anonymous access](https://api-portal.tfl.gov.uk/products)
- [TfL API catalogue](https://api-portal.tfl.gov.uk/apis)
- [TfL transport data licence and attribution](https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service)
- [TfL official example API requests](https://tfl.gov.uk/cdn/static/cms/documents/example-api-requests.pdf)
- [Android TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech)
- [Android JavascriptInterface](https://developer.android.com/reference/android/webkit/JavascriptInterface)
- [Hackathon rules and judging criteria](https://amazonappdev2026.devpost.com/rules)
- [Hackathon emulator FAQ](https://amazonappdev2026.devpost.com/details/faqs)

The UI carries the required TfL, OS, and Geomni attribution and identifies Handback as an independent app. No TfL logo, endorsement, accuracy guarantee, or official affiliation is claimed. The data is governed by its upstream licence, not Handback's MIT source licence.

The judging criteria equally weight implementation, design, potential impact, and idea quality. This upgrade supplies a real integration and a more deliberate device interaction. Potential impact remains a hypothesis until target users try it.
