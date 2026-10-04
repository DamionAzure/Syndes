# Account-scoped learning data

Status: accepted

The MVP requires approved sign-in to access published Modules, including the currently anonymous browse path. On a shared device, each Learner's downloaded Modules, saved answers, and Progress belong to that Learner's Account and are hidden after sign-out. Downloads remain for that Account's next sign-in. Learners may study offline until explicit sign-out; the session refreshes when online. Progress stays on the device for the MVP and does not sync across devices. This changes the existing device-wide local Progress model so one Learner cannot see another's work.

Teacher Drafts also belong to their author's Account and are hidden from every other Account. Account separation inside Syndes covers ordinary switching; separate operating-system logins are required when local file confidentiality matters.

If an Administrator removes a Learner's approval while the device is offline, downloaded Modules remain usable until the device reconnects or the Learner signs out. On reconnection, Syndes enforces the removal. Existing device-wide Progress and Drafts are never assigned to the first Account that signs in; an approved Account may explicitly import legacy local data once.

After revocation is learned, Syndes immediately hides that Account's local Modules and Progress but retains them. Restored approval restores access to the saved work. An explicit Account deletion or local-data reset removes it.
