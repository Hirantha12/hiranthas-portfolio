// The game's openings, written in normal chess notation (White's move, then Black's).
// Each line must be exactly 9 moves each, legal, and end with Black (the visitor) giving checkmate.
// After editing, run `npm run games`: it checks every line with chess.js and rebuilds src/data/games.js.
// [id, name, one-line idea shown at the start, moves]
export const LINES = [
 ['englund', 'Englund Gambit trap', 'An offbeat reply to 1.d4. Your queen raids his queenside and the c1 square falls.', '1.d4 e5 2.dxe5 Nc6 3.Nf3 Qe7 4.h3 h6 5.Bf4 Qb4+ 6.Bd2 Qxb2 7.Bc3 Bb4 8.Qd2 Bxc3 9.Qxc3 Qc1#'],
 ['budapest', 'Budapest Gambit, Kieninger trap', 'You give a pawn, pin his knight, and finish with a knight mate on d3.', '1.d4 Nf6 2.c4 e5 3.dxe5 Ng4 4.Bf4 Nc6 5.Nf3 Bb4+ 6.Nbd2 Qe7 7.a3 Ngxe5 8.h3 h6 9.axb4 Nd3#'],
 ['blackburne', 'Blackburne Shilling Gambit', 'A cheeky knight jump to d4. If he grabs the pawn, his king gets smothered.', '1.e4 e5 2.Nf3 Nc6 3.a3 a6 4.h3 h6 5.Bc4 Nd4 6.Nxe5 Qg5 7.Nxf7 Qxg2 8.Rf1 Qxe4+ 9.Be2 Nf3#'],
 ['stafford-queen', 'Stafford Gambit, queen sacrifice', 'You let him take your queen, then hunt his king with two bishops.', '1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nc6 4.Nxc6 dxc6 5.d3 Bc5 6.Bg5 h6 7.Bh4 Nxe4 8.Bxd8 Bxf2+ 9.Ke2 Bg4#'],
 ['stafford-hunt', 'Stafford Gambit, king hunt', 'Your bishop crashes into f2 and his king walks into a mating net.', '1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nc6 4.Nxc6 dxc6 5.e5 Ne4 6.d3 Bc5 7.dxe4 Bxf2+ 8.Ke2 Qd4 9.c3 Bg4#'],
 ['stafford-h', 'Stafford Gambit, h-file attack', 'He castles into your attack. Knight and queen aim at h2.', '1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nc6 4.Nxc6 dxc6 5.d3 Bc5 6.Be2 h5 7.O-O Ng4 8.h3 Qd6 9.d4 Qh2#'],
 ['siberian', 'Siberian trap', 'A Sicilian where your knights and queen gang up on h2.', '1.e4 c5 2.Nf3 Nc6 3.Nc3 e6 4.Bc4 Qc7 5.O-O Nf6 6.Qe2 Ng4 7.d3 a6 8.h3 Nd4 9.Nxd4 Qh2#'],
 ['fishing-pole', 'Fishing Pole trap', 'You dangle a knight as bait on g4. If he bites, the h-file opens.', '1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Ng4 5.h3 h5 6.hxg4 hxg4 7.Ne1 Qh4 8.f3 g3 9.d4 Qh2#'],
 ['traxler', 'Traxler Counterattack', 'He attacks f7, you attack f2 harder. A wild line from the Two Knights.', '1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 Bc5 5.Nxf7 Bxf2+ 6.Kxf2 Nxe4+ 7.Kg1 Qh4 8.g3 Qf6 9.Nxh8 Qf2#'],
 ['froms', "From's Gambit trap", 'He opens with f4 and you counter with a gambit that ends on g3.', '1.f4 e5 2.fxe5 d6 3.exd6 Bxd6 4.b3 Nc6 5.Bb2 Be6 6.a3 a6 7.Nc3 Qh4+ 8.g3 Qxg3+ 9.hxg3 Bxg3#'],
 ['qp-ne3', 'Knight sacrifice on e3', 'A sneaky knight jump to e3. If he takes it, the dark squares open.', '1.d4 Nf6 2.Nd2 e5 3.dxe5 Ng4 4.a3 Nc6 5.b3 a6 6.Bb2 b6 7.h3 Ne3 8.fxe3 Qh4+ 9.g3 Qxg3#'],
 ['fools', "Fool's mate, the slow way", 'He pushes pawns on the wrong side, then opens his king himself.', '1.a3 e5 2.b4 Nc6 3.c3 d5 4.d3 Be6 5.Bb2 a6 6.Nd2 Bd6 7.f3 Nh6 8.Rb1 O-O 9.g4 Qh4#'],
 ['grob', 'Grob Attack gone wrong', 'He starts with 1.g4. You build calmly, and his weakened king pays.', '1.g4 d5 2.h3 e5 3.d3 Nc6 4.c3 Be6 5.Nd2 Bd6 6.a3 a6 7.b4 Nh6 8.f3 O-O 9.Bb2 Qh4#'],
 ['scholars', "Scholar's mate, reversed", 'The famous beginner trap, played by Black for once: queen and bishop on f2.', '1.a3 e5 2.b3 Bc5 3.Bb2 Nc6 4.Nh3 d6 5.Nc3 Be6 6.Rb1 Qh4 7.a4 Nf6 8.a5 O-O 9.Ng5 Qxf2#'],
];
