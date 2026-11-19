// Explain actual rules, not just the two action names. Keep new engines here too.
const instructions = {
    invaders: ['Raise L to move one lane left.', 'Raise R to move one lane right.', 'Fire is automatic. Both friendly and enemy shots chip the bunkers; fire through the gaps or drill a tunnel. Cover stays damaged between waves. Amber ! warns of incoming fire. Quick kills chain to x4; a clean fleet adds a wave bonus and one personal shield.'],
    lander: ['Raise L to fire the left engine: brake and step right.', 'Raise R to fire the right engine: brake and step left.', 'Both together fire centrally: stronger braking, no sideways move. Every burn slows descent. Impulses are fixed; lower a wrist to fire it again. Line up over the broad pad and land at 32 or less. Centered landings at 8 or less earn x2. Fuel refills at the next pad.'],
    snake: ['Raise L to queue a relative left turn.', 'Raise R to queue a relative right turn.', 'The outlined cell shows the next step. You can replace a queued turn before the clock ticks. A quick signal earns 40, otherwise 20. Every fourth pickup adds 80 and trims two tail cells. Avoid the wall and your body; three collisions end the run.'],
    sort: ['Send the current file to Images.', 'Send the current file to Text.', 'PNG, JPG, BMP and GIF go left. TXT, MD and RTF go right. Preview the next files; five correct copies restore one heart. Receipt-time extra moves are harmless.'],
    stack: ['Drop the moving window onto the stack.', 'Reverse its horizontal movement.', 'Drop inside the marked zone for a forgiving snap and 40 points. Smaller overlaps earn 20 and trim the next window. Four snaps restore a heart. Reverse freely; it does not reset the deadline.'],
    ski: ['Move one lane left.', 'Move one lane right.', 'Pass between the red poles before they cross the dashed skier line. Each route is at most one lane from the last. Five clean gates add 50 bonus points; three tree hits end the run.'],
    popups: ['Left wrist clears the left stack.', 'Right wrist clears the right stack.', 'Match the arrow. Move into an arrow box. Hold briefly, then move on; no home return. Bigger groups score more. Empty moves cost nothing.'],
    maze: ['Raise your left wrist for L.', 'Raise your right wrist for R.', 'Memorise a route. Plain pages are safe. Penalties grow each round; DIE ends the run from round 4. A penalty-free route always exists. Home adds 8 seconds. PEEK shows two choices; orange swaps them. Preview time is free.'],
    juggle: ['Lift the left wrist to catch falling GIFs in L.', 'Lift the right wrist to catch falling GIFs in R.', 'Catch only close to the line, inside the marked band. Later catches score more. Touch the line for x2; you have a short grace to catch. One lift catches all falling GIFs in that lane. Four catches mark a gift: catch it again for slow time or a one-use net. More GIFs join at 25 and 55 seconds. Three drops end the run.'],
    parry: ['Raise the left guard briefly.', 'Raise the right guard briefly.', 'Watch which side the attack comes from. Raise that guard near impact, not when the attack first appears.'],
    binary: ['Rotate the current row one position.', 'Change its first bit between 0 and 1.', 'Make CURRENT match TARGET. Rotating lets you bring any bit into the first position.'],
    gravity: ['Switch between attraction to floor and ceiling.', 'Slow the obstacles for two seconds.', 'Switch to the open surface before a barrier reaches you. Slow time needs five seconds to recharge.'],
    orbital: ['Rotate the curved shield one step.', 'Rotate it one step in the opposite direction.', 'Keep the shield between the ball and the edge of the circle. The ball moves on its own.'],
    beat: ['Hit a note in the left lane.', 'Hit a note in the right lane.', 'Lift as the note reaches the horizontal line. Early inputs are acknowledged but cannot hit distant notes.'],
    reactor: ['Vent heat; this also reduces power slightly.', 'Increase power; this also adds heat.', 'Keep HEAT between its marks while producing power. Repeated charges can overheat the core.'],
    marble: ['Give the marble a short push left.', 'Give it a short push right.', 'The marble keeps some momentum. Line it up with the gap before it falls to the gate.'],
    gel: ['Add one small dose of gel to the bubble.', 'Release the bubble into the container.', 'Match the bubble to the outlined container before releasing it. Several left lifts may be needed.'],
    dock: ['Swap the first and second dock icons.', 'Swap the second and third dock icons.', 'Use adjacent swaps to match the reference row above.'],
    school: ['Toggle the left gate open or closed.', 'Toggle the right gate open or closed.', 'Let the orange fish through. Close a gate for the dark shark silhouette marked !. Gates stay as you leave them.'],
    bubbles: ['Choose the other launch arc.', 'Launch one bubble along the selected arc.', 'Aim at either cluster. A hit bursts connected bubbles; wait for the current shot before launching again.'],
    garden: ['Water the outlined plant.', 'Give sunlight to the outlined plant.', 'The CARE outline moves between plants. Keep both resource bars healthy; too much of one resource hurts.'],
    memory: ['Raise L for the blue tile.', 'Raise R for the purple tile.', 'Watch the order, then repeat it for 10 per tile. Tiles already shown can be answered live for 20. Finishing adds 10 per tile, doubled when every tile was live. A wrong tile costs a heart and replays the same order.'],
    merge: ['Slide the row left; the next tile enters on the right.', 'Slide the row right; the next tile enters on the left.', 'Equal neighbours merge once per slide and score their value; two merges in one slide double it. Every merge refills the clock. A full row with no equal neighbours costs a heart and keeps only its biggest tile.'],
    rail: ['Switch the junction between stations A and B.', 'Dispatch the front train from the platform.', 'Trains queue on their own. Set the junction before a train reaches the fork; its letter is its station. Back-to-back arrivals on the same line add a convoy bonus. A fifth waiting train or a wrong station costs a heart.'],
    tangram: ['Rotate the loose paper shape by a quarter turn.', 'Stamp it into its matching outline.', 'Rotate until the loose shape has the same orientation as the highlighted target, then stamp.'],
    golf: ['Cycle through soft, medium and firm power.', 'Take a stroke when the ball is still.', 'Choose enough power to reach the cup slowly. Wait for a missed shot to reset before trying another power.'],
    balance: ['Add a small counterweight on the left.', 'Add a small counterweight on the right.', 'Add weight to the lighter, higher side to level the hanging bar. Let it settle before adding more.'],
    prisms: ['Turn the selected mirror between its two angles.', 'Select the next mirror.', 'Follow the light ray. Turn and select mirrors until the beam reaches the gold target circle.'],
    abyss: ['Give the jellyfish an upward swimming impulse.', 'Give it a gentle downward impulse.', 'Momentum persists. Steer through the clear opening in each approaching reef.'],
    orbit: ['Cycle through three launch angles.', 'Launch the probe along the dotted preview.', 'Choose the path that bends around the planet toward the target. Wait for a probe to finish before launching again.'],
    clockwork: ['Advance BOTH clock hands by one mark.', 'Advance only the second hand.', 'Align the first hand first, then adjust the second. Match both small gold circles.'],
    contour: ['Turn the pencil clockwise by a quarter turn.', 'Draw one straight grid segment.', 'Draw a closed outline around the gold survey point. Return to the start without crossing the existing line.'],
    stars: ['Select the next star.', 'Connect the selected star if it is next in the reference.', 'Follow the numbered drawing in the top corner. The circle marks your current selection.']
};

export function lessonFor(engine) {
    const [left, right, tip] = instructions[engine] || [];
    if (!tip) throw new Error(`Missing tutorial for ${engine}`);
    return { left, right, tip };
}
