import {SPECS} from 'battlecode';
import {CONSTANTS, CIRCLES} from './constants.js'
import {move_towards, move_to, no_swarm, move_away} from './path.js'
import {COMM8,COMM16} from './comm.js'
import {getAttackOrder, has_adjacent_castle, getNearbyRobots, dist, is_valid, is_passable} from './utils.js'

function Point(x, y, p) {
  this.x = x,
  this.y = y,
  this.p = p
}

//Still needs a lot of work
function prophet_move_away(self, enemies) {

  let maxdir = [0,0];
  let maxdist = 0;
  for (const dir of CIRCLES[SPECS.UNITS[self.me.unit].SPEED]){
    let sum = 0;
    let temp = [self.me.x + dir[0], self.me.y + dir[1]]
    if (!is_valid(temp[0], temp[1], self.map.length) || !self.map[temp[1]][temp[0]] || self.getVisibleRobotMap()[temp[1]][temp[0]] != 0){
      continue;
    }
    if (self.me.x == 26 && self.me.y == 0){
      self.log(temp)
    }
    for (let enemy of enemies){
      sum+=dist([enemy.x, enemy.y],temp)
    }
    if (sum > maxdist){
      maxdist = sum
      maxdir = dir
    }
  }
  return maxdir
}

function is_nono(self,x,y,base_loc){
  //Ret, base_locationurns true if this x and y is a nuisance; false if not
  let nono_map = [...Array(self.map.length)].map(e => Array(self.map.length).fill(false));
  nono_map[base_loc[1]][base_loc[0]] = true;
  for (const r of self.getVisibleRobots()) {
    if (r.team == self.me.team) {
      if (r.unit == SPECS.CHURCH || r.unit == SPECS.CASTLE) { // castle or church
        nono_map[r.y][r.x] = true;
        for (const dir of CIRCLES[2])
          if (is_valid(r.x + dir[0], r.y + dir[1], self.map.length))
            nono_map[r.y + dir[1]][r.x + dir[0]] = true;
      } else if (r.id !== self.me.id) {
        nono_map[r.y][r.x] = true;
        for (const dir of CIRCLES[1])
          if (is_valid(r.x + dir[0], r.y + dir[1], self.map.length))
            nono_map[r.y + dir[1]][r.x + dir[0]] = true;
      }
    }
  }
  return nono_map[y][x]
}

function local_cluster_info(self, base_loc) {
  let minicurrent, minix, miniy;

  let maxr = 0
  let visited = new Set()
  let miniqueue = [(base_loc[1]<<6)|base_loc[0]];

  while (miniqueue.length > 0) {
    minicurrent = miniqueue.shift();
    minix = minicurrent&63
    miniy = (minicurrent&4032)>>6

    if (visited.has(minicurrent)){ continue; }

    if (self.fuel_map[miniy][minix] || self.karbonite_map[miniy][minix]) {
      maxr = Math.max(maxr, dist(base_loc, [minix, miniy]))
    } else if (miniy !== base_loc[1] || minix !== base_loc[0]) {
      continue; // don't continue exploring a non-fuel or karb. spot
    }

    visited.add(minicurrent);
    for (const dir of CIRCLES[8]) {
      if (is_valid(minix+dir[0], miniy+dir[1], self.map.length)) {
        miniqueue.push(((miniy+dir[1])<<6)|(minix+dir[0]));
      }
    }
  }

  return maxr;
}

function nonNuisanceBehavior(self, base_loc, waffle = true) {
  // first find resource_r, the r^2 of the resource that is furthest from base,
  // within the cluster.

  let r_sq = local_cluster_info(self, base_loc)

  let current;
  let visited = new Set()
  let queue = [new Point(self.me.x, self.me.y, null)];
  let path_end_point = null;

  while (queue.length > 0) {
    current = queue.shift();

    if (visited.has((current.y<<6)|current.x)){ continue; }

    if (self.map[current.y][current.x] && is_passable(self,current.x,current.y) &&
        dist(base_loc, [current.x, current.y]) > r_sq && 
        (current.x + current.y) % 2 == 0) {
      path_end_point = current;
      break;
    }

    visited.add((current.y<<6)|current.x);
    for (const dir of CIRCLES[SPECS.UNITS[self.me.unit].SPEED]) {
      if (is_valid(current.x+dir[0], current.y+dir[1], self.map.length)) {
        if (is_passable(self,current.x,current.y) && self.map[current.y + dir[1]][current.x + dir[0]]) {
          queue.push(new Point(current.x + dir[0], current.y + dir[1], current));
        }
      }
    }
  }

  if (path_end_point === null || path_end_point.p === null) { // you already good. Move towards the base if you're too far.
    return null;
  } else {
    while (path_end_point.p.p !== null){
      path_end_point = path_end_point.p;
    }
    return [path_end_point.x - self.me.x, path_end_point.y - self.me.y];
  }

}

function attack_behaviour_aggressive(self, mode_location, base_location){
  //Always pursue mode_location, and kill anyone seen

  //attack enemy if possible
  let targets = getAttackOrder(self)
  if (targets.length>0){
    return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
  }

  //pursue visible enemies without swarming
  for (const r of self.getVisibleRobots()) {
    if (self.isVisible(r) && r.unit !== null && r.team != self.me.team) {
      let move = no_swarm(self,[self.me.x,self.me.y],[r.x,r.y])
      if (move !== null) {
        return self.move(move.x - self.me.x, move.y - self.me.y);
      }
    }
  }

  //If nobody is visible, just pursue the mode_location (which in this case would be the enemy)
  if (mode_location !== null) {
    let vis_map = self.getVisibleRobotMap()
    if (vis_map[mode_location[1]][mode_location[0]] != 0) {
      let move = move_towards(self, [self.me.x, self.me.y], [mode_location[0], mode_location[1]])
      if (move !== null) {
        return self.move(move.x - self.me.x, move.y - self.me.y);
      } else {
        return null;
      }
    } else {
      return CONSTANTS.ELIMINATED_ENEMY;
    }
  }
  return null
}

function attack_behaviour_passive(self, mode_location, base_location){
  //Pursue mode_location, but strategically move away when engaging enemies. Try to hit without getting hit
  //This method is only effective with prophets

  let vis_map = self.getVisibleRobotMap()
  //attack enemy, but MAKE SURE crusader is between prophet and enemy
  let targets = getAttackOrder(self)
  if (targets.length != 0){
    let crusaders = []
    let enemies = []
    //if there is a single enemy robot without a crusader in front, move away
    //since this method is called by prophets, it must be certain that they are protected by crusaders
    for (const p of self.getVisibleRobots()){
      if (self.isVisible(p) && p.unit == SPECS.UNITS[SPECS.CRUSADER]){
        crusaders.push([p.x,p.y])
      }
      if (self.isVisible(p) && p.team != self.me.team && p.unit > 2){
        enemies.push(p)
      }
    }
    let escape = false;
    for (const r of targets){
      let unsafe = true;
      for (const c of crusaders){
        if (dist(c,[r.x,r.y])<dist([r.x,r.y,self.me.x,self.me.y])){
          unsafe = false;
          break
        }
      }
      if (unsafe){
        escape = true
        break
      }
    }
    if (escape){
      let move = move_away(self,enemies)
      if (move !== null) {
        return self.move(move[0],move[1]);
      }
      else{
        return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
      }
    }
    else{
      return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
    }
  }

  //Pursue the enemy without swarming
  else if (vis_map[mode_location[1]][mode_location[0]]!=0){
    let move = no_swarm(self,[self.me.x,self.me.y],[mode_location[0],mode_location[1]])
    // let move = null;
    if (move !== null) {
      return self.move(move.x - self.me.x, move.y - self.me.y);
    }
  }

  //Enemy has been killed
  else {
    return CONSTANTS.ELIMINATED_ENEMY
  }
}

function defensive_behaviour_aggressive(self, mode_location, base_location) {
  //If the robot sees an enemy, it will chase it, kill it, and come back to base

  //attack enemy if possible
  let targets = getAttackOrder(self)
  if (targets.length>0){
    return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
  }

  //pursue any visible enemy robots
  for (const r of self.getVisibleRobots()) {
    if (self.isVisible(r) && r.unit !== null && r.team !== null && r.team != self.me.team) {
      let move = move_towards(self, [self.me.x, self.me.y], [r.x, r.y])
      if (move !== null) {
        // self.log(move.x, move.y)
        return self.move(move.x - self.me.x, move.y - self.me.y);
      }
      else{
        return null;
      }
    }
  }

  //Pursue mode_location 
  if (mode_location !== null) {
    // self.log(self.getVisibleRobotMap()[mode_location[1]][mode_location[0]])
    let vis_map = self.getVisibleRobotMap()
    if (vis_map[mode_location[1]][mode_location[0]] == -1) {
      // self.log('move_towards2')
      let move = move_towards(self, [self.me.x, self.me.y], [mode_location[0], mode_location[1]])
      if (move !== null) {
        // self.log("go from " + [self.me.x,self.me.y] + " to " + [move.x, move.y])
        return self.move(move.x - self.me.x, move.y - self.me.y);
      } else {
        return null;
      }
    }

    else {
      return CONSTANTS.ELIMINATED_ENEMY;
    }
  } 

  //move back to base; give resources if you have them; Otherwise, move away if you're sitting on resources or waffle
  else {
    if (dist([self.me.x,self.me.y],base_location) >= 25) {
      // self.log("move_towards3")
      let move = move_to(self, [self.me.x, self.me.y], [base_location[0], base_location[1]])
      if (move !== null && !(is_nono(self,move.x,move.y, base_location))) {
        return self.move(move.x - self.me.x, move.y - self.me.y);
      } else {
        return null;
      }
    } else if ((self.me.karbonite > 0 || self.me.fuel > 0) && (Math.abs(self.me.x - base_location[0]) <= 1 && Math.abs(self.me.y - base_location[1]) <= 1)) {
      return self.give(base_location[0] - self.me.x, base_location[1] - self.me.y, self.me.karbonite, self.me.fuel);
    } else {
      // self.log("nonNuisanceBehavior")
      let n = nonNuisanceBehavior(self,base_location, false);
      if (n !== null){
        return self.move(n[0],n[1]);
      }
      else{
        return null;
      }
     }
  }
}

function defensive_behaviour_passive(self, mode_location, base_location) {
  //If the robot sees an enemy, wait for the enemy to come so the enemy will get hit first. Never leave base
  // self.log("here1")

  //attack if possible
  let vis_map = self.getVisibleRobotMap()
  //attack enemy, but MAKE SURE crusader is between prophet and enemy
  let targets = getAttackOrder(self)
  if (targets.length != 0){
    let crusaders = []
    let enemies = []
    //if there is a single enemy robot without a crusader in front, move away
    //since this method is called by prophets, it must be certain that they are protected by crusaders
    for (const p of self.getVisibleRobots()){
      if (self.isVisible(p) && (p.unit == SPECS.UNITS[SPECS.CRUSADER] || p.unit == SPECS.UNITS[SPECS.PREACHER])){
        crusaders.push([p.x,p.y])
      }
      if (self.isVisible(p) && p.team != self.me.team && p.unit > 2){
        enemies.push(p)
      }
    }
    let escape = false;
    for (const r of targets){
      let unsafe = true;
      for (const c of crusaders){
        if (dist(c,[r.x,r.y])<dist([r.x,r.y,self.me.x,self.me.y])){
          unsafe = false;
          break
        }
      }
      if (unsafe){
        escape = true
        break
      }
    }
    if (escape){
      let move = move_away(self,enemies)
      if (move !== null) {
        return self.move(move[0],move[1]);
      }
      else{
        return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
      }
    }
    else{
      return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
    }
  }

  //go back to base if possible
  // self.log('here2')
  if (dist([self.me.x,self.me.y],base_location) >= 25) {
    let move = move_to(self, [self.me.x, self.me.y], [base_location[0],base_location[1]])
    if (move !== null) {
      return self.move(move.x - self.me.x, move.y - self.me.y);
    }
    else{
      return null;
    }
  } 

  //give resources if possible (given that you are already at base)
  else if ((self.me.karbonite > 0 || self.me.fuel > 0) && (Math.abs(self.me.x - base_location[0]) <= 1 && Math.abs(self.me.y - base_location[1]) <= 1)) {
    return self.give(base_location[0] - self.me.x, base_location[1] - self.me.y, self.me.karbonite, self.me.fuel);
  } 

  //Don't be annoying; get off resources spots and waffle
  else {
    // self.log('no nuis');
    // self.log(self.me.x)
    // self.log(self.me.y)
    let n = nonNuisanceBehavior(self,base_location);
    if (self.me.x == 26 && self.me.y == 0){
      self.log("here1")
      self.log(n)
    }
    if (n !== null){
      return self.move(n[0],n[1]);
    }
    else{
      return null;
    }
  }
}

export class CrusaderManager {
  constructor(self) {
    this.mode = CONSTANTS.DEFENSE
    this.mode_location = null;
    this.base_location = null;
    const vis_map = self.getVisibleRobotMap()
    for (const dir of CIRCLES[2]) {
      if (self.map[self.me.y + dir[1]] && self.map[self.me.y + dir[1]][self.me.x + dir[0]]) {
        if (vis_map[self.me.y + dir[1]][self.me.x + dir[0]] > 0) {
          let r = self.getRobot(vis_map[self.me.y + dir[1]][self.me.x + dir[0]]);
          if (r.team == self.me.team && SPECS.UNITS[r.unit].SPEED == 0) { // castle or church
            this.base_location = [r.x, r.y];
            break;
          }
        }
      }
    }
  }

  turn(step, self) {
    // self.log('here-crus')
    for (const r of self.getVisibleRobots()) {
      if (COMM16.type(r.signal) == COMM16.ENEMYCASTLE_HEADER) {
        this.mode = CONSTANTS.ATTACK
        this.mode_location = COMM16.DECODE_ENEMYCASTLE(r.signal)
      }
    }

    if (this.base_location == null) {
      this.mode = CONSTANTS.ATTACK
    }

    if (this.mode == CONSTANTS.DEFENSE) {
      let action = defensive_behaviour_passive(self, this.mode_location, this.base_location)
      if (action !== null){
        return action
      }
      else{
        return null
      }
    }

    if (this.mode == CONSTANTS.ATTACK && this.mode_location !== null) {
      let action = attack_behaviour_aggressive(self, this.mode_location);
      if (action == CONSTANTS.ELIMINATED_ENEMY) {
        self.log("enemy castle dead")
        self.log(self.me.x)
        self.castleTalk(COMM8.ENEMY_CASTLE_DEAD);
        this.mode = CONSTANTS.DEFENSE
        this.mode_location = null;
      } else {
        return action
      }
    }
  }
}


export class ProphetManager {
  constructor(self) {
    this.mode = CONSTANTS.DEFENSE
    this.mode_location = null;
    this.base_location = null;

    const vis_map = self.getVisibleRobotMap()
    for (const dir of CIRCLES[2]) {
      if (self.map[self.me.y + dir[1]] && self.map[self.me.y + dir[1]][self.me.x + dir[0]]) {
        if (vis_map[self.me.y + dir[1]][self.me.x + dir[0]] > 0) {
          let r = self.getRobot(vis_map[self.me.y + dir[1]][self.me.x + dir[0]]);
          if (r.team == self.me.team && SPECS.UNITS[r.unit].SPEED == 0) { // castle or church
            this.base_location = [r.x, r.y];
            break;
          }
        }
      }
    }
  }

  turn(step, self) {
    // self.log('here-prop')
    for (const r of self.getVisibleRobots()) {
      if (COMM16.type(r.signal) == COMM16.ENEMYCASTLE_HEADER) {
        this.mode = CONSTANTS.ATTACK
        this.mode_location = COMM16.DECODE_ENEMYCASTLE(r.signal)
      }
      else if (COMM16.type(r.signal) == COMM16.BASELOC_HEADER && step < 3){
        this.mode = CONSTANTS.DEFENSE
        this.base_location = COMM16.DECODE_BASELOC(r.signal)
        //self.log([self.me.x, self.me.y] + " NEWBASE @ " + COMM16.DECODE_BASELOC(r.signal))
        this.mode_location = null
      }
    }
    if (this.base_location == null) {
      this.mode = CONSTANTS.ATTACK
    }

    if (this.mode == CONSTANTS.DEFENSE) {
      let action = defensive_behaviour_passive(self, this.mode_location, this.base_location)
      return action;
    }

    if (this.mode == CONSTANTS.ATTACK && this.mode_location !== null) {
      let action = attack_behaviour_passive(self, this.mode_location);
      if (action == CONSTANTS.ELIMINATED_ENEMY) {
        this.mode_location = null;
        this.mode = CONSTANTS.DEFENSE;
        self.log("enemy castle dead")
        self.log(self.me.x)
        self.castleTalk(COMM8.ENEMY_CASTLE_DEAD);
      } else {
        return action
      }
    }
  }
}

// PREACHER BEHAVIOR is just CRUSADER - the escort stuff
export class PreacherManager {
  constructor(self) {
    this.mode_location = null;
    this.base_location = null;

    const vis_map = self.getVisibleRobotMap()
    for (const dir of CIRCLES[2]) {
      if (self.map[self.me.y + dir[1]] && self.map[self.me.y + dir[1]][self.me.x + dir[0]]) {
        if (vis_map[self.me.y + dir[1]][self.me.x + dir[0]] > 0) {
          let r = self.getRobot(vis_map[self.me.y + dir[1]][self.me.x + dir[0]]);
          if (r.team == self.me.team && SPECS.UNITS[r.unit].SPEED == 0) { // castle or church
            this.base_location = [r.x, r.y];
            break;
          }
        }
      }
    }
  }

  turn(step, self) {

    for (const r of self.getVisibleRobots()) {
      if (COMM16.type(r.signal) == COMM16.ENEMYSIGHTING_HEADER) {
        this.mode_location = COMM16.DECODE_ENEMYSIGHTING(r.signal)
        // self.log(this.mode_location)
      }
      else if (COMM16.type(r.signal) == COMM16.BASELOC_HEADER){
        this.base_location = COMM16.DECODE_BASELOC(r.signal)
        this.mode_location = null
      }
    }
    // self.log('here-prea')
    let action = defensive_behaviour_aggressive(self, this.mode_location, this.base_location)
    if (action == CONSTANTS.ELIMINATED_ENEMY) {
      this.mode_location = null;
      action = defensive_behaviour_aggressive(self, this.mode_location, this.base_location)
    }
    return action;
  }
}