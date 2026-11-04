# Flying the biplane

Introduced in **0.91.0**, this is a lightweight
light-aircraft simulation for Aclone, not a certified training simulator or a replica
of a particular real aircraft. The model uses lift, drag, thrust, gravity, momentum
and angle of attack; it does not simulate wind gusts, structural flex or engine systems.

## Controls

Use two hands:

- **W / S:** increase / decrease throttle. Release the key to leave it where you set it.
  **Ground pushback (0.91.1):** while stopped or moving slowly on the ground,
  keep holding S after reaching idle to back up at walking speed (at most 1.5 m/s).
  A/D steer while backing; B stops you. Release S to coast to a stop, or use W to
  taxi forward again. This represents manual ground handling and works with the
  engine off or an empty tank. In flight, S only reduces throttle. On touch controls,
  hold Power −; on a controller, hold throttle-down at idle.
  There is no reverse thrust. Going from idle to full power takes about four seconds.
- **A / D:** rudder left / right, also steering the wheels while taxiing.
- **Down arrow:** pull back to raise the nose. **Up arrow:** push forward to lower it.
- **Left / Right arrows:** bank left / right. A short tap changes the attitude by a
  few degrees; releasing the arrows gradually steadies the nose and levels the
  wings. Analog sticks retain more authority. Banking turns the aircraft.
- **B:** airbrake in flight, wheel brakes on the ground. Reduce power with S and
  hold B to slow a fast arrival and descend near approach speed. World owners can
  disable airborne braking; the wheel brake still works.
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

## Flight visibility and terrain

Airborne views use haze out to 1.6 km in clear weather and 1 km in storms.
Ground and marine visibility returns after landing. Buildings fade into the same
haze, while streamed trees and rocks thin out individually before their loading
boundary. Distant towns use the surrounding island mesh rather than a separate
patch of finer terrain.

Terrain detail accounts for height as well as distance. The renderer prepares
squares ahead of your velocity, restores nearby detail first during descent, and
uses an intermediate grid between fine and distant ground at circuit height.
Above the detail-retention height the loaded ground uses the coarse selection.
Road and surface masks keep the same resolution across those selections. On foot
the existing detail distances are unchanged. These are client graphics choices;
there is no new world-owner rule. **F9 → Options & pilot key → Performance**
targets 30 FPS if the default graphics mode is too slow.

## First practice flight

Choose clear, reasonably level land with **at least 150–200 metres of straight run**
and additional room beyond it. Trees, buildings, steep banks and water are hazards.
There is no automatic runway alignment or instant vertical takeoff.

1. Drive to **Puddlewick airfield hangar**, on the western edge of the main town,
   to buy or board a biplane. The purchase price is paid into the hangar till.
   The aircraft appears on the apron with its engine off;
   start it with F4. Check fuel and, on worlds requiring
   licences, obtain the pilot qualification. Taxi at low throttle using A/D.
2. Line up, release B, and increase power with W. The tail comes up as speed builds.
3. Around **45–55 mph**, gently tap Down to rotate. Full throttle alone does not lift
   the aircraft from level ground. Holding Down continuously can cause a stall.
4. Keep a modest nose-up attitude. Level off by easing the nose down as needed.
5. Use small banks to turn. Watch altitude: a steep bank leaves less lift supporting
   your weight. Release the bank keys early to let the wings settle; counter-bank
   when a quicker correction is needed.

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

Approach a clear strip at roughly **54 mph (24 m/s by default)**, reduce power
with S, and hold B to slow and descend. Release the arrows between small corrections
so the attitude settles. Just above the surface, tap Down gently for a late flare,
then keep B held for the ground roll. B tapers its extra drag at low speed, so it
does not by itself stall a level slow approach.
Avoid landing across a steep hillside or trying to stop immediately upon touchdown.

Default contacts allow up to **8 m/s** of sink, **25°** of bank, pitch between
**−15° and +25°**, **40°** of slip and **44.7 m/s (100 mph)**. These are survival
limits, not approach targets. A ten-metre-per-second dive or a 45° bank still
destroys the aircraft. Speed and sideways arrivals have separate notices.
Smooth slopes under the wheelbase count as rolling terrain; sudden rises still
count as impacts. An 18-metre blend softens the runway shoulders by default.
The owner can tune these rules or select **Strict landing contacts** to restore
the old 3.5 m/s, 12° bank, −0.1-radian/+20° pitch, 0.35-radian slip and 36 m/s limits.
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
landing, a complete parked-to-airborne-to-stopped flight with delayed discrete inputs,
crashes, timestep consistency and prediction isolation. Browser tests cover
live input delivery, cockpit rendering and the authoritative destruction notice.

The stall and bank/lift relationships were informed by the
[FAA Airplane Flying Handbook, Chapter 5](https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/06_afh_ch5.pdf).
The coefficients and forgiving impact thresholds are tuned for this game.

## Airfield and replacement aircraft

Puddlewick’s public airfield targets a level, marked **400 × 30 metre** north/south
runway. It uses the longest safe surveyed site when the full length cannot fit;
the ordinary 300/310-metre town fixtures currently fit 250/260-metre strips.
The pavement and level clearance stay within town; the gentle blend can extend
into adjoining clear countryside. An existing hangar and private property stay
in place when a legacy strip is upgraded. The hangar is east of the strip. Use the map’s building marker
to find it; taxi slowly west from the apron, then line up at either end. There is
no automatic alignment. Garages continue to handle ground vehicles; biplanes
require the hangar in Puddlewick (worlds without a hangar retain their garage desk). Stop before boarding and wait if another pilot occupies the
apron. The runway is reserved against new buildings and farm plots.

Your hangar panel shows the ready aircraft plus spare airframes. A crash removes
only the aircraft flown. The next visit commissions a spare without another
purchase charge; its tank is empty and its condition is new. Buy Fuel at the
hangar or bring some with you, then use it from your inventory. The hangar also
buys Fuel for 50d, five denarii more than the boathouse pump and more than
Harbour stores or the garage pay, and less than its own 53.50d pump. The parish
puts 500s in the till for those purchases. Existing aircraft
keep their parked fuel, paint and maintenance history. Spares do not copy these
consumables or records from a destroyed machine.

Confirmed crashes produce a brief fireball, sparks and rising smoke visible to
nearby players. The effect fades after eight seconds; reconnecting does not
replay old crashes. It does not change the existing crash injury rules.
