# GiveLoop Release 12.3  (2026-09-30)

## ✨ New features
* **Recurring gifts**: donors can now pause, skip or change the amount of a monthly gift
* **SSO** for staff logins
* **API v2**
* **AI summary** of donor notes
  * summarises up to 50 notes per donor
  * works in English and French
1) Matching-gift lookup at checkout (Benevity, YourCause)
2) Tax-receipt PDFs in English et français
- Peer-to-peer fundraising pages with team leaderboards
- Peer-to-peer fundraising pages with team leaderboards
- Text-to-give keyword campaigns

## 🐛 Bug fixes
- Fixed bug where receipts failed to send when the donor name contained an accent
- Fixed a crash on the pledge report
- Fixed typo on login page

## Under the hood
- Upgraded to Node 22
- Migrated the job queue to Postgres
- CI/CD pipeline speed-ups

## Known issues
- Safari 15 users may see a layout glitch in the donor timeline
