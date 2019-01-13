
export let CONSTANTS {
  // attacking troops:
  DEFENSE = 0,
  OFFENSE = 1,
  ESCORT = 2,

  // stages:
  EXPLORATION: 49,
  BUILDUP: 50,
  ATTACK: 51,

  ELIMINATED_ENEMY = 100,
  ABANDON_ESCORT = 101,

}

export let ATTACK_RANGES_MAX{

  3: 16,
  4: 64,
  5: 16,

}

export let ATTACK_RANGES_MIN{

  3: 1,
  4: 16,
  5: 1,

}

export let VISIBLE_RANGES{

  2: 100
  3: 36,
  4: 64,
  5: 16,

}

export let COMM8 {
  BUILT_PILGRIM: 1,
  BUILT_CRUSADER: 2,
  BUILT_PREACHER: 3,

  BUILDUP_STAGE: 50,

  // If we have <64 static messages, then we can setup location sending too:
  HEADER_MASK: 0b11<<6,

  X_HEADER: 0b10<<6,
  X: function(x){ return 0b10<<6 + x; },
  DECODE_X: function(s) { return s&63; }

  Y_HEADER: 0b11<<6,
  Y: function(y){ return 0b10<<6 + y; },
  DECODE_Y: function(s) { return s&63; }

}

export let COMM16 {
  // signalling communications

  HEADER_MASK: 0b1111<<12, // and the signal with this, then compare them to various headers.

  ESCORT_HEADER: 0b0001<<12,
  ESCORT: function(pilgrim_id){ return (0b0001<<12) + pilgrim_id; },
  DECODE_ESCORT: function(s){ return s&4095; },

  ATTACK_HEADER: 0b0010<<12,
  ATTACK: function(x,y){ return (0b0010<<12) + (y<<6) + x; },
  DECODE_ATTACK: function(s){ return [s&0b111111,(s&(0b111111<<6))>>6]; }, // x, y

  DISTRESS_HEADER: 0b0011<<12,
  DISTRESS: function(x,y){ return (0b0011<<12) + (y<<6) + x; },
  DECODE_DISTRESS: function(s){ return [s&0b111111,(s&(0b111111<<6))>>6]; }, // x, y

  ENEMYLOC_HEADER: 0b0100<<12,
  ENEMYLOC: function(x,y){ return (0b0100<<12) + (y<<6) + x; },
  DECODE_ENEMYLOC: function(s){ return [s&0b111111,(s&(0b111111<<6))>>6]; }, // x, y

  GOTO_HEADER: 0b0101<<12,
  GOTO: function(x,y){ return (0b0101<<12) + (y<<6) + x; },
  DECODE_GOTO: function(s){ return [s&0b111111,(s&(0b111111<<6))>>6]; }, // x, y

}

export let CIRCLES { // all directions within R^2 of a point
  1: [[-1, 0], [0, -1], [0, 1], [1, 0]],
  2: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  3: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  4: [[-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  5: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  6: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  7: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  8: [[-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  9: [[-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  10: [[-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1], [-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  11: [[-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1], [-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  12: [[-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1], [-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  13: [[-3, -2], [-3, 2], [-2, -3], [-2, 3], [2, -3], [2, 3], [3, -2], [3, 2], [-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1], [-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  14: [[-3, -2], [-3, 2], [-2, -3], [-2, 3], [2, -3], [2, 3], [3, -2], [3, 2], [-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1], [-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  15: [[-3, -2], [-3, 2], [-2, -3], [-2, 3], [2, -3], [2, 3], [3, -2], [3, 2], [-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1], [-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
  16: [[-4, 0], [0, -4], [0, 4], [4, 0], [-3, -2], [-3, 2], [-2, -3], [-2, 3], [2, -3], [2, 3], [3, -2], [3, 2], [-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1], [-3, 0], [0, -3], [0, 3], [3, 0], [-2, -2], [-2, 2], [2, -2], [2, 2], [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1], [-2, 0], [0, -2], [0, 2], [2, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [0, -1], [0, 1], [1, 0]],
}