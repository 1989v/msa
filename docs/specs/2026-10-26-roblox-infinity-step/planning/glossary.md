# Local Roblox vocabulary

| Term | Meaning and lifecycle |
|---|---|
| Region | Authored course section with a fixed safe entrance. Established by stable landing on a tagged course platform. |
| Safe platform | Known solid course platform on which the avatar has stably landed; transient contact and height alone do not qualify. |
| Fall snapshot | Server capture of the last stable platform ID and departure height, retained during descent and after lower landings. Death carries it to free ground respawn. |
| Revival offer | Optional character-bound choice referring to a fall snapshot; dismiss, resumed progress, restart or replacement invalidates its action token. No debit has occurred. |
| Revival ticket | Consumable inventory unit. One verified Developer Product receipt grants one; one accepted revival reserves one. |
| Pending delivery | Durable obligation containing operation ID, course version and platform ID, written atomically with ticket debit. Survives offer invalidation, death and disconnection; recovery completes before controls resume. |
| Delivery acknowledgement | Atomic clearing of the matching pending operation after safe placement, preserving all concurrent receipt grants. Failure retries while movement remains frozen. |
