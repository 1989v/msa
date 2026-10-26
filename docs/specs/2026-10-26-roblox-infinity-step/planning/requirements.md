# Requirements

- Build a separate Roblox adaptation of Infinity Step; preserve the Unity/web original.
- First slice: three short urban climbing regions, five discrete charge levels, no steering during a charged jump, ordinary falling onto lower platforms, current/best height, keyboard and touch controls.
- Paid, repeat-purchasable revival tickets return the player to the last safe platform before the meaningful fall. User explicitly selected “떨어지기 직전 밟았던 발판으로 복귀”, replacing the earlier agent region-entrance default.
- Capture the return platform before the fall; do not replace it with a lower landing. Free continuation always remains possible. No forced purchase dialog or countdown.
- Separate buying a ticket from consuming it. Roblox server receipt processing persistently grants exactly one ticket per purchase ID; explicit use consumes at most one ticket per fall and returns to a server-selected safe target.
- Unconfigured live purchases are disabled. Studio has a clearly separated local test inventory, never presented as a successful real purchase.
- Supply editable Luau, a reproducible Roblox place artifact, setup instructions, and honest verification evidence. No external assets or services are required for the first course.
- Price, product ID, live Roblox publication and real-money verification are release configuration, not blockers for the local prototype.
- Also deliver one reusable porting prompt and a sourced Roblox development reference guide, as requested in the follow-up.
