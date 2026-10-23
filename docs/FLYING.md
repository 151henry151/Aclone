# Flying the biplane

Introduced in **0.91.0**, this is a lightweight
light-aircraft simulation for Aclone, not a certified training simulator or a replica
of a particular real aircraft. The model uses lift, drag, thrust, gravity, momentum
and angle of attack; it does not simulate wind gusts, structural flex or engine systems.

## Controls

Use two hands:

- **W / S:** increase / decrease throttle. Release the key to leave it where you set it.
  There is no reverse thrust. Going from idle to full power takes about four seconds.
- **A / D:** rudder left / right, also steering the wheels while taxiing.
- **Up / Down arrows:** raise / lower the nose.
- **Left / Right arrows:** bank left / right. Release to stop rolling; use the opposite
  arrow to return the wings to level. Banking turns the aircraft.
- **B:** wheel brakes. Reduce power before braking after landing.
- **F4:** engine on/off. Turning it off in flight means gliding, not stopping.
- **C:** change camera. Drag the cockpit view to look around; its horizon moves with
  the aircraft. The chase camera stays upright.

On touch screens, Power +/−, rudder, Nose ↑/↓, Bank ◀/▶ and Brakes provide the same
controls. On a controller, the left stick changes throttle and rudder, the right
stick controls pitch/bank, and the left shoulder button brakes. Up on the right
stick raises the nose, matching the keyboard; this is not a conventional inverted
flight-stick mapping. The ordinary driving bindings remain unchanged for tractors.

**Chat and menus do not pause flight.** Opening them releases control inputs but
leaves throttle set. Stay clear of terrain before opening a panel. A disconnected
pilot's movement stops under Aclone's existing offline rules; reconnecting resumes
the saved flight state. Land and shut down before signing off.

## First practice flight

Choose clear, reasonably level land with **at least 150–200 metres of straight run**
and additional room beyond it. Trees, buildings, steep banks and water are hazards.
There is no automatic runway alignment or instant vertical takeoff.

1. Switch into your owned biplane at a garage. Check fuel and, on worlds requiring
   licences, obtain the pilot qualification. Taxi at low throttle using A/D.
2. Line up, release B, and increase power with W. The tail comes up as speed builds.
3. Around **45–55 mph**, gently tap Up to rotate. Full throttle alone does not lift
   the aircraft from level ground. Holding Up continuously can cause a stall.
4. Keep a modest nose-up attitude. Level off by easing the nose down as needed.
5. Use small banks to turn. Watch altitude: a steep bank leaves less lift supporting
   your weight. Counter-bank to level the wings before returning to the airfield.

These are practice targets, not exact guarantees: slope, ground grip, engine
condition and the aircraft's attitude affect the ground run and flight path.

## Reading the cockpit

The textured gauges show airspeed (mph), artificial horizon, altitude above sea
level (metres), heading (degrees), climb/descent rate (m/s) and engine RPM. RPM is an
indication derived from engine state and throttle. The bottom strip shows fuel and
**AGL**, altitude above the terrain directly below. AGL is more useful than the
altimeter when approaching a hill. The HUD also shows throttle, AGL and vertical
speed; **STALL — LOWER NOSE** appears when the wing exceeds its stall angle.

The yoke moves with pitch/roll response, the throttle lever follows the setting,
and the propeller and engine sound respond to power. Instrument updates are limited
to the visible local cockpit to keep rendering inexpensive.

## Stalls and gliding

A stall is caused by too much angle of attack, not merely a fixed low speed. Pulling
hard up while slow, or making a steep turn without enough lift, can start one.
Lower the nose, level the wings and add power. Wait for speed to recover before
pulling up gently. Recovery needs height; a stall just above the ground may be fatal
to the aircraft.

With the engine off or fuel exhausted, lower the nose enough to maintain flying
speed and pick a clear landing area. The aircraft continues moving and descending.
It cannot hover or stop in mid-air.

## Landing and damage

Approach a clear strip at roughly **55 mph**, reduce power with S, and keep the
wings level. Control the descent with pitch and power. Just above the surface,
raise the nose gently to reduce the sink rate, then close the throttle and brake.
Avoid landing across a steep hillside or trying to stop immediately upon touchdown.

The current game checks terrain-relative sink rate (over **3.5 m/s** is a hard
landing), bank over **12°**, nose/tail attitude, sideways drift and excessive speed.
An aircraft hitting buildings, water or the world edge at speed is also destroyed.
Slow ground bumps stop it instead. These are gameplay thresholds, not real flying
advice.

A crash removes **only the active aircraft** from your owned fleet, including that
airframe's saved fuel, condition and paint. Other vehicles and their tanks remain.
You return on foot, injured, with a notice explaining the accident. Replacing the
plane costs the normal garage price. You cannot avoid impact by switching vehicles,
entering a home or starting a ground activity while airborne.

## Implementation and verification

`src/shared/flight.ts` runs the same substepped dynamics on the server and in local
prediction; the server owns crash outcomes. Saved flight state includes throttle,
attitude and velocity. Remote clients interpolate pitch and bank along with position.
Unit tests cover controls, takeoff distance, stalls/recovery, banking, gliding,
landing, crashes, timestep consistency and prediction isolation. Browser tests cover
live input delivery, cockpit rendering and the authoritative destruction notice.

The stall and bank/lift relationships were informed by the
[FAA Airplane Flying Handbook, Chapter 5](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/06_afh_ch5.pdf).
The coefficients and forgiving impact thresholds are tuned for this game.
