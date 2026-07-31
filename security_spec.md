# Security Specifications & Data Invariants

## Data Invariants
1. **Locations and Tour Packages (Tourism Data)**: Must only be writable by verified administrators (`role == 'admin'`).
2. **Users**: A user can only write/update their own user document, except that they cannot escalate their own privilege (escalation from 'user' to 'admin' is blocked). Default admin email `ivanfadhilamaulana1@gmail.com` is automatically hard-coded as `admin`.
3. **Reviews and Itineraries**: Must be owned by the user who created them (`userId == request.auth.uid`). Users can write/delete their own reviews and itineraries.
4. **Submissions, Logs, and Notifications**: Submissions can be created by authenticated users but only managed/written/updated by administrators. Logs and Notifications can only be written by administrators.

## The Dirty Dozen Payloads
We define 12 malicious payloads to test the security of our Firestore rule constraints:
1. **P1 (Privilege Escalation on User Profile)**: Standard user `usr_hacker` attempts to update their user doc `/users/usr_hacker` to set `role` to `admin`. (Should be denied)
2. **P2 (Identity Spoofing on User Profile)**: User `usr_hacker` attempts to overwrite someone else's user doc `/users/usr_victim`. (Should be denied)
3. **P3 (Direct Write to Locations)**: Non-admin user attempts to write/add a new document to `/locations/loc_new`. (Should be denied)
4. **P4 (Direct Write to Tour Packages)**: Non-admin user attempts to modify `/tour_packages/pack_1`. (Should be denied)
5. **P5 (Foreign Review Creation)**: User `usr_hacker` attempts to create a review under `userId: "usr_victim"`. (Should be denied)
6. **P6 (Foreign Itinerary Creation)**: User `usr_hacker` attempts to create/overwrite an itinerary under `userId: "usr_victim"`. (Should be denied)
7. **P7 (Direct Write to Audit Logs)**: Non-admin user attempts to insert or modify a document under `/logs/log_1`. (Should be denied)
8. **P8 (Direct Write to Admin Notifications)**: Non-admin user attempts to write a document under `/notifications/notif_1`. (Should be denied)
9. **P9 (Approved Status Injection in Submissions)**: Standard user attempts to submit a location proposal that is pre-marked as `status: "approved"`. (Should be denied)
10. **P10 (Invalid ID character injection)**: Standard user attempts to write to `/locations/loc$$%hacker` with an invalid ID format. (Should be denied)
11. **P11 (Null Auth Injection)**: Unauthenticated user attempts to read private/sensitive collections or write anywhere. (Should be denied)
12. **P12 (Impersonation of Admin Email)**: Unverified standard user attempts to claim email `ivanfadhilamaulana1@gmail.com` with `email_verified: false` to write to `/locations`. (Should be denied)

## Test Runner (Mock)
The tests will ensure that all twelve payloads return `PERMISSION_DENIED` under normal circumstances.
