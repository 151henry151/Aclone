# Human motion sources

Walking and running are adapted from the [CMU Graphics Lab Motion Capture Database](http://mocap.cs.cmu.edu/), retrieved 2026-10-23. These are recorded joint motions, not a downloaded character model. Aclone's body mesh, textures, rig, retargeting and runtime foot constraints are original project work.

The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

CMU states that the dataset is free for all uses. Its [FAQ](http://mocap.cs.cmu.edu/faqs.php) permits copying, modification and redistribution without permission, including commercial products, and asks for attribution. Preserve this notice with the source and derived motion data. Do not apply the project's GPL source-code header to the original capture files or imply they were created by Aclone.

Sources:

- [Subject 07 skeleton](http://mocap.cs.cmu.edu/subjects/07/07.asf) and [walking capture 07_01](http://mocap.cs.cmu.edu/subjects/07/07_01.amc).
- [Subject 09 skeleton](http://mocap.cs.cmu.edu/subjects/09/09.asf) and [running capture 09_02](http://mocap.cs.cmu.edu/subjects/09/09_02.amc).

`npx tsx scripts/human-motion.ts` regenerates `src/client/generated/human-motion.json` without network access. It solves ASF/AMC joint positions, scales the legs to our rig, aligns forward travel, chooses a complete contact-to-contact cycle, removes root travel, closes the loop and filters capture jitter into 48 samples per gait. The running cycle is mirrored to align the starting foot. These derived clips retain the source permission and attribution above.

The browser blends the recorded poses by speed, adjusts stride length to actual travel, retargets limbs onto the game's 17-bone rig and constrains soles/stance contacts. Game physics continues to own position and speed; animation does not change movement rules. The original full captures are development inputs and are not downloaded by players.
