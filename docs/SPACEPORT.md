# Puddlewick spaceport

Version 0.109.0 relocates the existing public spaceport to a vacant site just over one kilometre from Puddlewick town centre. The live-world migration preview selected a pad about 1.25 km away.
It keeps the building ID, stock, prices, investment and ownership. Existing homes,
businesses, farms and gathering sites are not moved. The operation runs once on
server startup; if no safe site or access route exists, it leaves the port alone.
The chosen site is saved, rather than selected again on every restart.

The site search checks rings 1.15–1.25 km from town and requires 650 m clearance from other existing buildings, along with clearance from players, resources, cliffs and the airfield. A **1 km no-build reservation** prevents later
encroachment. A smaller **600 m-radius chain-link security fence** surrounds the
working compound. The southeast gate and access road lead to the terminal; the
fence blocks ground vehicles and pedestrians. Farms and grazing expansions must
also respect the reservation. Only the apron is graded, with broad blended
shoulders into the existing hills. The fence follows the ground. World-design
exports include the site, fence and reservation.

## Visual effects

Exhaust has bright engine cores, a merging jet and turbulent incandescent parcels.
Near the pad those parcels spread outward, while dust/steam puffs expand, drift,
rise and fade. Ground clouds start only once the descending exhaust reaches the
pad; they linger briefly after cutoff. Flight times and cargo schedules are unchanged.
The effect reconstructs a bounded number of particles from flight time, so joining
mid-flight or returning from a background tab does not replay a backlog. Shader
clocks use elapsed flight time rather than the increasingly large world age.

## References and design choices

- [NASA/Bill Ingalls, Falcon 9 launch, June 3, 2017](https://www.nasa.gov/image-article/falcon-9-liftoff-from-historic-launch-pad/): primary visual reference for the narrow bright exhaust and rolling ground clouds.
- [NASA TEMPO launch, April 7, 2023](https://science.nasa.gov/blogs/tempo/2023/04/07/weve-got-liftoff-the-falcon-9-begins-its-journey/): night-time glow and illuminated exhaust clouds.
- [NASA Crew-9 booster landing, September 28, 2024](https://www.nasa.gov/blogs/commercialcrew/2024/09/28/falcon-9-first-stage-sticks-landing-2/): outward-spreading landing dust close to touchdown.
- [Kennedy Space Center viewing locations](https://www.kennedyspacecenter.com/launches-and-events/see-a-launch/launch-viewing-locations/): several-kilometre public viewing distances, including about 6.27 km from LC-39A at one viewing site.
- [FAA launch-site FAQ](https://www.faa.gov/space/additional_information/faq): public safety and useful orbital access determine launch-site location.

The earlier five-kilometre separation was replaced at the player’s request with a compact site near town. The new location is a gameplay compromise,
not a universal real-world minimum for houses. Actual safety distances depend on
propellants, vehicle, trajectory and site-specific risk analysis; public viewing
distances are context, not residential planning standards. The game retains its
fictional reusable cargo ship and abstracts terminal boarding and ground operations.

The permanent reservation is only 1 km in radius, to preserve buildable countryside;
the fence stays at 600 m. The layout migration removes the obsolete site, fence and exact old access roads, preserving the existing spaceport ID, ownership, stock and accounts. It runs once and is idempotent.

The revised launch effect uses a 320 m free exhaust plume for the large fictional
cargo ship, a soft turbulent fringe, and rolling pad clouds hundreds of metres
across. The ground clips the jet instead of compressing its whole length; the
landing plume remains 52 m. Three instanced draws bound the cost (six jet sheets,
160 hot parcels and 180 steam/dust parcels), with no extra shadow maps or lights.

Additional visual references:

- [NASA STS-125 Atlantis liftoff](https://science.nasa.gov/image-detail/sts-125-launch-may-11-2009/): brilliant continuous cores and large, warm-lit rolling clouds.
- [NASA SCIFLI Artemis I imagery](https://scifli.larc.nasa.gov/sample-uhd-imagery/): broad luminous exhaust and turbulent fringes immediately below the nozzles.

Run `node --import tsx scripts/rocket-takeoff.ts` to generate a 46-second normal-speed
MP4 of the production model and effects on the relocated terrain. This is a local
preview, not a production world mutation. Set `ROCKET_STILLS=1` for screenshots only.
