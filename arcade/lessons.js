// Explain actual rules, not just the two action names. Keep new engines here too.
const instructions = {
    invaders: ['Move the ship one step left.', 'Move the ship one step right.', 'Shots fire automatically. Line up under the descending aliens.'],
    lander: ['Fire a short upward thrust; this uses fuel.', 'Slow your descent with the air brake.', 'Reach the pad with a descent speed below 32. Leave time between thrusts.'],
    snake: ['Queue a left turn for the next grid step.', 'Queue a right turn for the next grid step.', 'Turns are relative to the snake. One corner is queued at a time; collect the + signs.'],
    sort: ['Send the current file to Images.', 'Send the current file to Text.', 'PNG and JPG belong in Images. TXT and MD belong in Text. Watch the deadline bar.'],
    stack: ['Drop the moving window onto the stack.', 'Reverse its horizontal movement.', 'Wait until the moving window overlaps the one below. Poor overlap costs an attempt.'],
    ski: ['Move one lane left.', 'Move one lane right.', 'Choose the empty lane before the row of trees reaches the skier.'],
    popups: ['Left wrist clears the left stack.', 'Right wrist clears the right stack.', 'Match the arrow. Return to chest height between moves; the dot lights when ready. Bigger groups score more. Empty moves cost nothing.'],
    maze: ['Follow the left link.', 'Follow the right link.', 'A wrong link is marked 404. Try the other one and remember the route.'],
    juggle: ['Bounce the falling GIF in the left lane.', 'Bounce the falling GIF in the right lane.', 'Lift when a GIF is coming down through the lower half, before it reaches the yellow platform.'],
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
    memory: ['Repeat a blue tile.', 'Repeat a purple tile.', 'First watch the flashing sequence. Only repeat it when the screen says Your turn.'],
    merge: ['Slide all tiles left.', 'Slide all tiles right.', 'Equal neighbours merge once per move. Each valid slide adds a new tile; the round ends when the row is blocked.'],
    rail: ['Switch the junction between stations A and B.', 'Dispatch the next train.', 'Set the junction before the train reaches the fork. Its colour shows its destination.'],
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
