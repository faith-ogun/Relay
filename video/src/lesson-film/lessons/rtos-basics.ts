import type { LessonScript } from '../types';

/**
 * Unit 11, Digital Logic & Embedded. Sits at the checkpoint for "Tasks and the
 * RTOS".
 *
 * Chosen for video because the idea is entirely about TIME, and time is the one
 * thing a static quiz cannot show. A learner can answer "the highest priority
 * Ready task runs" correctly and still picture the tasks running side by side,
 * which is the misconception that produces every priority-inversion bug they
 * will ever write. Here they watch one task stop mid-instruction because
 * something more urgent became Ready.
 *
 * Named for its skill id, not a nickname. upload.sh publishes to
 * gs://ohmlet-app-lessons/v1/<file id>/ and films.py signs
 * v1/<skill id>/, so a film file named anything else lands where nothing looks
 * for it. The first two films learned that the hard way and had to be moved.
 */
export const rtosBasics: LessonScript = {
  id: 'rtos-basics',
  title: 'Tasks and the RTOS',
  unitTitle: 'Digital Logic & Embedded',
  unitId: 'digital-logic',
  skillId: 'rtos-basics',
  skillTitle: 'Tasks and the RTOS',
  accent: '#549cf0',
  segments: [
    { text: 'Your program has one processor. It can only ever do one thing at a time.',
      scene: { kind: 'title' } },
    { text: 'Everything you are about to see is a trick for making that one thing look like several.',
      scene: { kind: 'statement', lines: ['One processor.', 'Many jobs.'] } },
    { text: 'Most embedded programs never need the trick. Arduino gives you a superloop, and it is enough.',
      scene: { kind: 'circuit', variant: 'board', flow: true, label: 'One loop, forever' } },
    { text: 'One while loop that checks every job in turn, round and round, for the life of the machine.',
      scene: { kind: 'statement', lines: ['Check job one.', 'Check job two.', 'Repeat.'] } },
    { text: 'It works until one job takes too long.',
      scene: { kind: 'statement', lines: ['Until one job', 'takes too long'] } },
    { text: 'Put a delay of one second in your loop, and for that whole second nothing else in the program exists.',
      scene: { kind: 'compare', left: 'Reading the sensor', right: 'Everything else, waiting', caption: 'What a delay actually costs' } },
    { text: 'A button pressed during that second is a button nobody heard.',
      scene: { kind: 'circuit', variant: 'board', flow: false, highlight: 'pin', label: 'Pressed, and missed' } },
    { text: 'Real time does not mean fast. It means the system meets its deadlines. Every time, not on average.',
      scene: { kind: 'statement', lines: ['Real time', 'means on time'] } },
    { text: 'A hard deadline missed is a failure. Not a slow frame. A failure.',
      scene: { kind: 'compare', left: 'Hard: missing it is a failure', right: 'Soft: missing it is a shame', caption: 'Two kinds of deadline' } },
    { text: 'An airbag has a hard deadline. A menu animation has a soft one. Know which you are building.',
      scene: { kind: 'statement', lines: ['Know which', 'you are building'] } },
    { text: 'An R T O S is a small kernel that runs your jobs as separate tasks and decides which one gets the processor.',
      scene: { kind: 'statement', lines: ['A kernel that', 'chooses for you'] } },
    { text: 'Every task is always in exactly one of four states.',
      scene: { kind: 'recap', items: [] } },
    { text: 'Running. Actually executing, right now. On one core, exactly one task is ever Running.',
      scene: { kind: 'recap', items: ['Running: exactly one'] } },
    { text: 'Ready. Able to run, waiting only for the processor to be free.',
      scene: { kind: 'recap', items: ['Running: exactly one', 'Ready: could run now'] } },
    { text: 'Blocked. Waiting for something. A message, a lock, a deadline. Costing nothing while it waits.',
      scene: { kind: 'recap', items: ['Running: exactly one', 'Ready: could run now', 'Blocked: waiting for something'] } },
    { text: 'And Suspended. Taken out of the running entirely until something resumes it.',
      scene: { kind: 'recap', items: ['Running: exactly one', 'Ready: could run now', 'Blocked: waiting for something', 'Suspended: out of the game'] } },
    { text: 'Blocked is the state that makes the whole thing work. A blocked task burns no processor at all.',
      scene: { kind: 'compare', left: 'Delay: burns the processor', right: 'Block: gives it away', caption: 'The difference that matters' } },
    { text: 'The scheduler is preemptive and priority based. The highest priority Ready task always runs.',
      scene: { kind: 'statement', lines: ['Highest priority', 'Ready task', 'always wins'] } },
    { text: 'Preemptive is the important word. A higher priority task becoming Ready stops the current one immediately.',
      scene: { kind: 'statement', lines: ['Stopped', 'mid-instruction'] } },
    { text: 'Not at a tidy boundary. Not when it finishes. Between two machine instructions, whatever it was doing.',
      scene: { kind: 'circuit', variant: 'board', flow: false, highlight: 'chip', label: 'Stopped, mid-instruction' } },
    { text: 'That is the sentence to remember, because every hard bug in this topic comes from forgetting it.',
      scene: { kind: 'statement', lines: ['Every hard bug', 'starts here'] } },
    { text: 'Three kernel objects cover almost all sharing between tasks.',
      scene: { kind: 'statement', lines: ['Mutex.', 'Semaphore.', 'Queue.'] } },
    { text: 'A mutex is mutual exclusion. One task holds it, and anything else that wants it blocks until it is given back.',
      scene: { kind: 'compare', left: 'Mutex: one at a time', right: 'Queue: hand data over', caption: 'Protect, or transfer' } },
    { text: 'Picture one I two C bus shared by a temperature task and a logging task, with no mutex between them.',
      scene: { kind: 'circuit', variant: 'board', flow: true, highlight: 'pin', label: 'One bus, two tasks' } },
    { text: 'One transaction gets preempted halfway through and the other starts talking. Both readings are now garbage.',
      scene: { kind: 'statement', lines: ['Two half', 'conversations'] } },
    { text: 'Now the trap. Priority inversion.',
      scene: { kind: 'statement', lines: ['Priority', 'inversion'] } },
    { text: 'A high priority task needs a mutex. A low priority task is holding it. So the high one blocks, correctly.',
      scene: { kind: 'compare', left: 'High: blocked, waiting', right: 'Low: holding the lock', caption: 'So far, working as designed' } },
    { text: 'Then a medium priority task becomes Ready. It outranks the low one, so it preempts it.',
      scene: { kind: 'statement', lines: ['Medium preempts low.', 'Low still holds', 'the lock.'] } },
    { text: 'The low task cannot finish and release the lock. The high task waits behind a task it outranks.',
      scene: { kind: 'statement', lines: ['The highest priority task', 'is now last'] } },
    { text: 'This is not a textbook curiosity. Mars Pathfinder kept resetting on the surface in 1997 for exactly this reason.',
      scene: { kind: 'statement', lines: ['Mars Pathfinder,', '1997'] } },
    { text: 'The fix is priority inheritance. While a low task holds a lock a high task wants, it borrows that priority.',
      scene: { kind: 'compare', left: 'Without: high waits for medium', right: 'With: low finishes fast', caption: 'Priority inheritance' } },
    { text: 'Three things to take with you.',
      scene: { kind: 'recap', items: [] } },
    { text: 'One. Blocking gives the processor away. Delaying keeps it and wastes it.',
      scene: { kind: 'recap', items: ['Block, do not delay'] } },
    { text: 'Two. Preemption happens between instructions, not at tidy boundaries.',
      scene: { kind: 'recap', items: ['Block, do not delay', 'Preemption is instant'] } },
    { text: 'Three. Anything two tasks share needs a mutex, and any mutex can invert priorities.',
      scene: { kind: 'recap', items: ['Block, do not delay', 'Preemption is instant', 'Shared means locked'] } },
    { text: 'Go and find a delay in code you have already written, and work out what it was stopping.',
      scene: { kind: 'outro' } },
  ],
};
