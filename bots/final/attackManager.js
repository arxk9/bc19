import {SPECS} from 'battlecode';
import {CONSTANTS, CIRCLES} from './constants.js'
import {move_towards, move_to, move_away} from './path.js'
import {COMM8,COMM16} from './comm.js'
import {getAttackOrder, dist, is_valid, is_passable, isHorizontalSymmetry} from './utils.js'

function is_lattice(self, myposition, base_loc, lattice_angle){
  if (is_valid(myposition[0], myposition[1], self.map.length) && 
  self.map[myposition[1]][myposition[0]] && 
  is_passable(self,myposition[0],myposition[1]) &&
  !self.fuel_map[myposition[1]][myposition[0]] &&
  !self.karbonite_map[myposition[1]][myposition[0]] &&
  dist(base_loc,myposition) > 2 &&
  (myposition[0] + myposition[1]) % 2 == 1 ){
    switch(lattice_angle){
      case 1: return Math.abs(myposition[1]-base_loc[1]) <= 2 && myposition[0] >= base_loc[0];
      case 2: return Math.abs(myposition[0]-base_loc[0]) <= 2 && myposition[1] <= base_loc[1];
      case 3: return Math.abs(myposition[1]-base_loc[1]) <= 2 && myposition[0] <= base_loc[0];
      case 4: return Math.abs(myposition[0]-base_loc[0]) <= 2 && myposition[1] >= base_loc[1];
      default: return true;
    }
  }
  return false;
}

function is_nonResource(self, myposition, base_loc){
  return is_valid(myposition[0], myposition[1], self.map.length) && 
  self.map[myposition[1]][myposition[0]] && 
  !self.fuel_map[myposition[1]][myposition[0]] &&
  !self.karbonite_map[myposition[1]][myposition[0]] &&
  is_passable(self,myposition[0],myposition[1]) &&
  dist(myposition,base_loc) > 2
}

function is_available(self, myposition, base_loc){
  return is_valid(myposition[0], myposition[1], self.map.length) && 
  self.map[myposition[1]][myposition[0]] && 
  is_passable(self,myposition[0],myposition[1]) &&
  dist(myposition,base_loc) > 2
}

function is_available2(self, myposition){
  return is_valid(myposition[0], myposition[1], self.map.length) && 
  self.map[myposition[1]][myposition[0]] && 
  is_passable(self,myposition[0],myposition[1])
}

function find_lattice_point(self, base_loc, lattice_point, lattice_angle){
  let closest_lattice_point = lattice_point !== null && is_lattice(self, lattice_point, base_loc, lattice_angle) ? lattice_point : null
  let mypos = [self.me.x, self.me.y]
  if (is_lattice(self, mypos, base_loc, lattice_angle) && (closest_lattice_point === null || dist(mypos, base_loc) < dist(closest_lattice_point,base_loc))){
    closest_lattice_point = [mypos[0], mypos[1]]
  }
  for (const dir of CIRCLES[4]){
    let current = [self.me.x + dir[0], self.me.y + dir[1]]
    if (is_lattice(self, current, base_loc, lattice_angle)) {
      if (closest_lattice_point === null || dist(current, base_loc) < dist(base_loc,closest_lattice_point)){
        closest_lattice_point = [current[0],current[1]]
      }
    }
  }
  return closest_lattice_point
}

function optimize(self, pos, lattice_angle){
  //trying to make this as small as possible
  switch(lattice_angle) {
    case 1: return self.map.length - pos[0] - 1
    case 2: return pos[1]
    case 3: return pos[0]
    case 4: return self.map.length - pos[1] - 1
  }
}

function crusader_back(self, lattice_angle){
  let visited = new Set()
  let queue = [(self.me.y<<6)|self.me.x];
  let current, cx, cy;

  let best = [self.me.x, self.me.y];

  while (queue.length > 0) {
    current = queue.shift();
    cx = current&63
    cy = (current&4032)>>6

    if (visited.has(current)){ continue; }

    if (cx !== self.me.x || cy !== self.me.y)
        if (self.getVisibleRobotMap()[cy][cx] !== 0 || !self.map[cy][cx] || 
            self.fuel_map[cy][cx] || self.karbonite_map[cy][cx])
          continue; // invalid spot

    if (optimize(self, [cx, cy], lattice_angle) < optimize(self, best, lattice_angle))
        best = [cx, cy];

    visited.add(current);

    for (const dir of CIRCLES[SPECS.UNITS[SPECS.CRUSADER].SPEED]) {
      if (is_valid(cx+dir[0], cy+dir[1], self.map.length)) {
        queue.push(((cy+dir[1])<<6)|(cx+dir[0]));
      }
    }
  }
  return best;
}

function lattice_movement(self, base_loc, lattice_point, lattice_angle) {
  // Since preachers have low vision, they can't reliably lattice
  // This will be a less ambitious version of nonNuisance
  //The lattice point has already been found; so just a* to it
  //If this point is null because there are no lattice points, look for a point without resources on it
  //If that's not available, look for a point that is far away from base
  let farthest_nonRes_point = null
  let farthest_point = null
  let counterpart = null
  switch(lattice_angle){
    case 1:
      counterpart = [self.map.length, self.me.y]
      break;
    case 2:
      counterpart = [self.me.x, 0]
      break;
    case 3:
      counterpart = [0, self.me.y]
      break;
    case 4:
      counterpart = [self.me.x, self.map.length]
      break;
    default:
      if (isHorizontalSymmetry(self.map, self.fuel_map, self.karbonite_map)){
        counterpart = [self.map.length - self.me.x, self.me.y]
      }
      else{
        counterpart = [self.me.x, self.map.length - self.me.y]
      }
  }

  let mypos = [self.me.x, self.me.y]
  let myspeed = SPECS.UNITS[self.me.unit].SPEED
  if (lattice_point !== null && self.me.x == lattice_point[0] && self.me.y == lattice_point[1]) {
    return null
  }
  if (lattice_point !== null && self.getVisibleRobotMap()[lattice_point[1]][lattice_point[0]] <= 0){
    if (dist(lattice_point, mypos) > myspeed){
      let move = move_to(self, mypos, lattice_point)
      if (move !== null){
        return [move.x, move.y]
      }
    }
    else{
      return lattice_point
    }
  }
  if (is_nonResource(self, mypos, base_loc)){
    farthest_nonRes_point = [mypos[0],mypos[1]]
  }
  if (is_available(self, mypos, base_loc)){
    farthest_point = [mypos[0],mypos[1]]
  }
  // self.log('here1')
  for (const dir of CIRCLES[SPECS.UNITS[self.me.unit].SPEED]){
    let current = [self.me.x + dir[0], self.me.y + dir[1]]

    if (is_nonResource(self, current, base_loc)){
      // self.log('here3')
      if (farthest_nonRes_point === null || dist(current, counterpart) < dist(counterpart,farthest_nonRes_point)){
        farthest_nonRes_point = [current[0],current[1]]
      }
    }

    if (is_available(self, current, base_loc)){
      if (farthest_point === null || dist(current, counterpart) < dist(counterpart,farthest_point)){
        farthest_point = [current[0],current[1]]
      }
    }
    // self.log('here4')
  }
  if (farthest_nonRes_point !== null){
    return farthest_nonRes_point
  }
  if (farthest_point !== null){
    return farthest_point
  }
  //If all else, fails, just go to the base
  let move = move_to(self, [self.me.x, self.me.y], [base_loc[0],base_loc[1]])
  if (move !== null) {
    return [move.x, move.y]
  }
  else{
    return null;
  }
}

function attack_behaviour_aggressive(self, mode_location){
  //Always pursue mode_location, and kill anyone seen

  //attack enemy if possible
  let targets = getAttackOrder(self)
  if (targets.length>0){
    return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
  }

  //pursue visible enemies without swarming
  for (const r of self.getVisibleRobots()) {
    if (self.isVisible(r) && r.unit !== null && r.team != self.me.team) {
      let move = move_towards(self,[self.me.x,self.me.y],[r.x,r.y])
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
        return self.move(move.x - self.me.x, move.y - self.me.y)
      } 
      else {
        return null;
      }
    } 
    else {
      return CONSTANTS.ELIMINATED_ENEMY;
    }
  }
  return null
}

function attack_behaviour_passive(self, mode_location){
  //Pursue mode_location, but strategically move away when engaging enemies. Try to hit without getting hit
  //This method is only effective with prophets

  let vis_map = self.getVisibleRobotMap()
  let targets = getAttackOrder(self)
  if (targets.length != 0){
    //attack enemy, but MAKE SURE protection is between prophet and enemy
    let crusaders = []
    let enemies = []
    let mypos = [self.me.x, self.me.y]
    //if there is a single enemy robot without a crusader in front, move away
    //since this method is called by prophets, it must be certain that they are protected by crusaders
    for (const p of self.getVisibleRobots()){
      let ppos = [p.x,p.y]
      if (self.isVisible(p) && p.team == self.me.team && (p.unit == SPECS.UNITS[SPECS.PREACHER] || p.unit == SPECS.UNITS[SPECS.CRUSADER])){
        crusaders.push([p.x,p.y])
      }
      if (self.isVisible(p) && p.team != self.me.team && p.unit > 2 && dist(mypos,ppos) < SPECS.UNITS[p.unit].VISION_RADIUS){
        enemies.push(p)
      }
    }
    let escape = false;
    for (const r of enemies){
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
  if (vis_map[mode_location[1]][mode_location[0]]!=0){
    let move = move_towards(self,[self.me.x,self.me.y],[mode_location[0],mode_location[1]])
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

function defensive_behaviour_aggressive(self, mode_location, base_location, pursuing=false) {
  //If the robot sees an enemy, it will chase it, kill it, and come back to base

  let receiver = null; //surrounding unit that can receive resource
  let mypos = [self.me.x, self.me.y]
  //attack enemy if possible
  let targets = getAttackOrder(self)
  if (targets.length>0){
    return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
  }

  //pursue any visible enemy robots
  for (const r of self.getVisibleRobots()) {
    let rpos = [r.x,r.y]
    if (self.isVisible(r) && r.unit !== null && r.team !== null && r.team != self.me.team) {
      let move = move_towards(self, [self.me.x, self.me.y], [r.x, r.y])
      if (move !== null) {
        return self.move(move.x - self.me.x, move.y - self.me.y);
      }
    }
  }

  if (pursuing){
    if (dist([self.me.x,self.me.y],base_location) > 25) {
      let move = move_to(self, [self.me.x, self.me.y], [base_location[0],base_location[1]])
      if (move !== null) {
        return self.move(move.x - self.me.x, move.y - self.me.y);
      }
      else{
        return null;
      }
    }
    else{
      return CONSTANTS.BASE_PURSUED
    }
  }
  //Pursue mode_location 
  if (mode_location !== null) {
    // self.log(self.getVisibleRobotMap()[mode_location[1]][mode_location[0]])
    let vis_map = self.getVisibleRobotMap()
    if (vis_map[mode_location[1]][mode_location[0]] != 0) {
      // self.log('move_towards2')
      let move = move_towards(self, [self.me.x, self.me.y], [mode_location[0], mode_location[1]])
      if (move !== null) {
        return self.move(move.x - self.me.x, move.y - self.me.y)
      } 
    }

    else {
      return CONSTANTS.ELIMINATED_ENEMY;
    }
  } 
  //move back to base; give resources if you have them; Otherwise, move away if you're sitting on resources or waffle
  else {

    if (self.me.karbonite > 0 || self.me.fuel > 0) {
      if (Math.abs(self.me.x - base_location[0]) <= 1 && Math.abs(self.me.y - base_location[1]) <= 1){
        return self.give(base_location[0] - self.me.x, base_location[1] - self.me.y, self.me.karbonite, self.me.fuel);
      }
      else if (receiver !== null){
        return self.give(receiver[0] - self.me.x, receiver[1] - self.me.y, self.me.karbonite, self.me.fuel);
      }
      else{
        let move = move_towards(self, [self.me.x, self.me.y], [base_location[0], base_location[1]], true)
        if (move !== null) {
          return self.move(move.x - self.me.x, move.y - self.me.y)
        } 
        else {
          return null;
        }  
      }
    }
    else{
      return CONSTANTS.SAVE_LATTICE
    }
  }
}

function defensive_behaviour_passive(self, base_location, pursuing=false) {
  //If the robot sees an enemy, wait for the enemy to come so the enemy will get hit first. Never leave base
  // self.log("here1")

  //attack if possible
  let vis_map = self.getVisibleRobotMap()
  let help = []
  let enemies = []
  let receiver = null; //surrounding unit that can receive resource
  let mypos = [self.me.x, self.me.y]
  //if there is a single enemy robot without a crusader in front, move away
  //since this method is called by prophets, it must be certain that they are protected by help
  for (const p of self.getVisibleRobots()){
    let ppos = [p.x,p.y]
    if (self.isVisible(p) && p.team == self.me.team && (p.unit == SPECS.UNITS[SPECS.CRUSADER] || p.unit == SPECS.UNITS[SPECS.PREACHER])){
      help.push([p.x,p.y])
    }
    if (self.isVisible(p) && p.team != self.me.team && p.unit > 2 && dist(mypos,ppos) < SPECS.UNITS[p.unit].VISION_RADIUS){
      enemies.push(p)
    }
    if (self.me.karbonite > 0 || self.me.fuel > 0){
      if (self.isVisible(p) && p.team == self.me.team && dist(ppos,mypos) <= 2 && dist(ppos,base_location) < dist(mypos,base_location)){
        if (p.karbonite < SPECS.UNITS[p.unit].KARBONITE_CAPACITY || p.fuel < SPECS.UNITS[p.unit].FUEL_CAPACITY){
          receiver = [p.x,p.y]
        }
      }
    }
  }
  //attack enemy, but MAKE SURE crusader is between prophet and enemy
  let targets = getAttackOrder(self)
  if (targets.length != 0){
    let escape = false;
    for (const r of enemies){
      let unsafe = r.unit !== SPECS.PROPHET; // don't run away from prophets
      for (const c of help){
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

  if (pursuing){
    if (dist([self.me.x,self.me.y],base_location) > 25) {
      let move = move_to(self, [self.me.x, self.me.y], [base_location[0],base_location[1]])
      if (move !== null) {
        return self.move(move.x - self.me.x, move.y - self.me.y);
      }
      else{
        return null;
      }
    }
    else{
      return CONSTANTS.BASE_PURSUED
    }
  }
  // //go back to base if possible
  // // self.log('here2')
  if (self.me.karbonite > 0 || self.me.fuel > 0) {
    if (Math.abs(self.me.x - base_location[0]) <= 1 && Math.abs(self.me.y - base_location[1]) <= 1){
      return self.give(base_location[0] - self.me.x, base_location[1] - self.me.y, self.me.karbonite, self.me.fuel);
    }
    else if (receiver !== null){
      return self.give(receiver[0] - self.me.x, receiver[1] - self.me.y, self.me.karbonite, self.me.fuel);
    }
    else{
      let move = move_towards(self, [self.me.x, self.me.y], [base_location[0], base_location[1]], true)
      if (move !== null) {
        return self.move(move.x - self.me.x, move.y - self.me.y);
      } else {
        return null;
      }  
    }
  }
  else{
    return CONSTANTS.SAVE_LATTICE;
  }
}

function lattice_behaviour(self){
  //attack enemy, but MAKE SURE crusader is between prophet and enemy
  let targets = getAttackOrder(self)
  if (targets.length != 0){
    return self.attack(targets[0].x-self.me.x,targets[0].y-self.me.y)
  }
  else{
    return CONSTANTS.SAVE_LATTICE
  }

}

function addCastle(self, r, lis){
  let myList = lis
  if (self.isVisible(r) && r.team != self.me.team && r.unit == 0){
    myList.push([r.x,r.y])
  }
  return myList
}

function signalDeadCastle(self, toSignal, loc){
  if (loc === null || !toSignal)
    return

  let N = self.map.length
  let horiSym = isHorizontalSymmetry(self.map, self.fuel_map, self.karbonite_map)
  let enemyBaseLoc = horiSym ? [loc[0], N - loc[1] - 1] : [N - loc[0] - 1, loc[1]]

  if (self.getVisibleRobotMap()[enemyBaseLoc[1]][enemyBaseLoc[0]] == 0)
    self.signal(COMM16.ENCODE_ENEMYDEAD(...enemyBaseLoc), dist([self.me.x, self.me.y], loc))
}

export class CrusaderManager {
  constructor(self) {
    this.mode = CONSTANTS.DEFENSE
    this.mode_location = null;
    this.base_location = null;
    this.lattice_point = null;
    this.lattice_angle = 0;
    this.enemy_castles = []
    this.toSignal = true;
    this.crusaderspam = false;

    this.base_is_castle = false
    const vis_map = self.getVisibleRobotMap()
    for (const dir of CIRCLES[2]) {
      if (self.map[self.me.y + dir[1]] && self.map[self.me.y + dir[1]][self.me.x + dir[0]]) {
        if (vis_map[self.me.y + dir[1]][self.me.x + dir[0]] > 0) {
          let r = self.getRobot(vis_map[self.me.y + dir[1]][self.me.x + dir[0]]);
          if (r.team == self.me.team && SPECS.UNITS[r.unit].SPEED == 0) { // castle or church
            this.base_location = [r.x, r.y];
            this.base_is_castle = (r.unit == SPECS.CASTLE)
            break;
          }
        }
      }
    }
  }

  turn(step, self) {
    for (const r of self.getVisibleRobots()) {
      this.enemy_castles = addCastle(self, r,this.enemy_castles)
      if (COMM16.type(r.signal) == COMM16.ENEMYCASTLE_HEADER) {
        this.mode = CONSTANTS.ATTACK
        this.mode_location = COMM16.DECODE_ENEMYCASTLE(r.signal)
      }
      if (COMM16.type(r.signal) == COMM16.HORDE_HEADER) {
        this.mode = CONSTANTS.PURSUING_BASE
        this.base_location = COMM16.DECODE_HORDE(r.signal)
        this.mode_location = null
      }
      if (COMM16.type(r.signal) == COMM16.ENEMYSIGHTING_HEADER){
        this.mode = CONSTANTS.ATTACK
        this.mode_location = COMM16.DECODE_ENEMYSIGHTING(r.signal)
      }
      if (COMM16.type(r.signal) == COMM16.LATTICE_HEADER){
        this.mode = CONSTANTS.LATTICE
        this.lattice_angle = COMM16.DECODE_LATTICE(r.signal)
      }
      if (COMM16.type(r.signal) == COMM16.ENEMYDEAD_HEADER){
        this.mode = CONSTANTS.LATTICE
        let tmp_loc = COMM16.DECODE_ENEMYDEAD(r.signal)
        let N = self.map.length
        let horiSym = isHorizontalSymmetry(self.map, self.fuel_map, self.karbonite_map)
        let enemyBaseLoc = horiSym ? [this.base_location[0], N - this.base_location[1] - 1] : [N - this.base_location[0] - 1, this.base_location[1]]
        if (dist(enemyBaseLoc, tmp_loc) == 0)
          this.toSignal = false;
      }
      if (COMM16.type(r.signal) == COMM16.CRUSADER_LATTICE_HEADER){
        this.crusaderspam = true;
        this.lattice_angle = COMM16.DECODE_CRUSADER_LATTICE(r.signal)
      }
    }
    if (this.crusaderspam){
      let mypos = [self.me.x, self.me.y]
      let place = crusader_back(self, this.lattice_angle)
      if (place !== null && (dist(place, [self.me.x, self.me.y]) > 0)) {
        if (dist(place, mypos) > SPECS.UNITS[self.me.unit].SPEED) {
          let move = move_to(self, mypos, place)
          if (move !== null) {
            return self.move(move.x - self.me.x, move.y - self.me.y)
          } else{
            return null
          }
        }
        else{
          return self.move(place[0]-self.me.x, place[1]-self.me.y)
        }
      } else{
        return null
      }
    }
    // self.log("here1")
    if (this.base_is_castle)
      signalDeadCastle(self, this.toSignal, this.base_location)
    let needLattice = false;
    if (this.mode == CONSTANTS.PURSUING_BASE){
      let action = defensive_behaviour_aggressive(self, this.mode_location, this.base_location, true)
      if (action == CONSTANTS.BASE_PURSUED){
        this.mode = CONSTANTS.DEFENSE
      }
      else{
        return action
      } 
    }
    if (this.mode == CONSTANTS.DEFENSE) {
      // self.log("here2")
      let action = defensive_behaviour_aggressive(self, this.mode_location, this.base_location)
      if (action == CONSTANTS.ELIMINATED_ENEMY){
        this.mode_location = null;
        needLattice = true;
      }
      if (action == CONSTANTS.SAVE_LATTICE){
        needLattice = true;
      }
      else{
        if (action !== null){
          return action
        }
        else{
          return null
        }
      }
    }

    if (this.mode == CONSTANTS.ATTACK && this.mode_location !== null) {
      let action = attack_behaviour_aggressive(self, this.mode_location);
      if (action == CONSTANTS.ELIMINATED_ENEMY) {
        // self.log("enemy castle dead")
        // self.castleTalk(COMM8.ENEMY_CASTLE_DEAD);
        this.mode = CONSTANTS.DEFENSE
        this.mode_location = null;
        return null
      } 
      else {
        return action
      }
    }

    if (this.mode == CONSTANTS.LATTICE || needLattice){
      let action = lattice_behaviour(self)
      if (action == CONSTANTS.SAVE_LATTICE){

        this.lattice_point = find_lattice_point(self, this.base_location, this.lattice_point, this.lattice_angle)

        //if we are already at the lattice point, then simply do nothing
        if (this.lattice_point !== null && self.me.x == this.lattice_point[0] && self.me.y == this.lattice_point[1]){
          this.lattice_point = null
          return null
        }

        let n = lattice_movement(self, this.base_location, this.lattice_point, this.lattice_angle);
        // self.log(""+n)
        if (n !== null && !(n[0] - self.me.x == 0 && n[1] - self.me.y == 0)){
          return self.move(n[0] - self.me.x,n[1] - self.me.y);
        }
        else{
          return null
        }
      }
      else{
        return action;
      }

    }
  }
}


export class ProphetManager {
  constructor(self) {
    this.mode = CONSTANTS.DEFENSE
    this.mode_location = null;
    this.base_location = null;
    this.lattice_point = null;
    this.lattice_angle = 0;
    this.enemy_castles = []
    this.toSignal = true;

    this.base_is_castle = false
    const vis_map = self.getVisibleRobotMap()
    for (const dir of CIRCLES[2]) {
      if (self.map[self.me.y + dir[1]] && self.map[self.me.y + dir[1]][self.me.x + dir[0]]) {
        if (vis_map[self.me.y + dir[1]][self.me.x + dir[0]] > 0) {
          let r = self.getRobot(vis_map[self.me.y + dir[1]][self.me.x + dir[0]]);
          if (r.team == self.me.team && SPECS.UNITS[r.unit].SPEED == 0) { // castle or church
            this.base_location = [r.x, r.y];
            this.base_is_castle = (r.unit == SPECS.CASTLE)
            break;
          }
        }
      }
    }
  }

  turn(step, self) {
    for (const r of self.getVisibleRobots()) {
      this.enemy_castles = addCastle(self, r,this.enemy_castles)
      if (COMM16.type(r.signal) == COMM16.ENEMYCASTLE_HEADER) {
        this.mode = CONSTANTS.DEFENSE
        this.mode_location = COMM16.DECODE_ENEMYCASTLE(r.signal)
        self.log(this.mode_location)
      }
      else if (COMM16.type(r.signal) == COMM16.BASELOC_HEADER){
        this.base_is_castle = false
        this.mode = CONSTANTS.DEFENSE
        let tmpBaseloc = COMM16.DECODE_BASELOC(r.signal);
        if (tmpBaseloc[0] != this.base_location[0] || tmpBaseloc[1] != this.base_location[1]){
          this.mode = CONSTANTS.PURSUING_BASE;
        }
        this.base_location = COMM16.DECODE_BASELOC(r.signal)
      }
      else if (COMM16.type(r.signal) == COMM16.HORDE_HEADER) {
        this.base_is_castle = false
        this.mode = CONSTANTS.DEFENSE
        let tmpBaseloc = COMM16.DECODE_HORDE(r.signal);
        if (tmpBaseloc[0] != this.base_location[0] || tmpBaseloc[1] != this.base_location[1]){
          this.mode = CONSTANTS.PURSUING_BASE;
        }
        this.base_location = COMM16.DECODE_HORDE(r.signal)
      }
      else if (COMM16.type(r.signal) == COMM16.LATTICE_HEADER){
        this.mode = CONSTANTS.LATTICE
        this.lattice_angle = COMM16.DECODE_LATTICE(r.signal)
      }
      else if (COMM16.type(r.signal) == COMM16.ENEMYDEAD_HEADER){
        this.mode = CONSTANTS.LATTICE
        let tmp_loc = COMM16.DECODE_ENEMYDEAD(r.signal)
        let N = self.map.length
        let horiSym = isHorizontalSymmetry(self.map, self.fuel_map, self.karbonite_map)
        let enemyBaseLoc = horiSym ? [this.base_location[0], N - this.base_location[1] - 1] : [N - this.base_location[0] - 1, this.base_location[1]]
        if (dist(enemyBaseLoc, tmp_loc) == 0)
          this.toSignal = false;
      }
    }
    if (this.base_is_castle)
      signalDeadCastle(self, this.toSignal, this.base_location)
    let needLattice = false;

    if (this.mode == CONSTANTS.PURSUING_BASE){
      let action = defensive_behaviour_passive(self, this.base_location, true)
      if (action == CONSTANTS.BASE_PURSUED){
        this.mode = CONSTANTS.DEFENSE
      }
      else{
        return action
      } 
    }

    if (this.mode == CONSTANTS.DEFENSE) {
      // self.log("defense")
      let action = defensive_behaviour_passive(self, this.base_location)
      if (action == CONSTANTS.SAVE_LATTICE){
        needLattice = true;
      }
      else{
        if (action !== null){
          return action
        }
        else{
          return null
        }
      }
    }

    if (this.mode == CONSTANTS.ATTACK && this.mode_location !== null) {
      // self.log("attack")
      let action = attack_behaviour_passive(self, this.mode_location);
      if (action == CONSTANTS.ELIMINATED_ENEMY) {
        // self.log("prophet says enemy castle dead")
        // self.castleTalk(COMM8.ENEMY_CASTLE_DEAD);
        this.mode = CONSTANTS.DEFENSE
        this.mode_location = null;
        return null
      } 
      else {
        return action
      }
    }

    if (this.mode == CONSTANTS.LATTICE || needLattice){
      // if (self.me.x == 37 && self.me.y == 0){
      //   self.log("lattice")  
      // }

      let action = lattice_behaviour(self)
      if (action == CONSTANTS.SAVE_LATTICE){

        this.lattice_point = find_lattice_point(self, this.base_location, this.lattice_point, this.lattice_angle)
        // if (self.me.x == 37 && self.me.y == 0){
        //   self.log(this.lattice_point)  
        // }
        //if we are already at the lattice point, then simply do nothing
        if (this.lattice_point !== null && self.me.x == this.lattice_point[0] && self.me.y == this.lattice_point[1]){
          this.lattice_point = null
          return null
        }

        let n = lattice_movement(self, this.base_location, this.lattice_point, this.lattice_angle);
        // self.log(""+n)
        if (n !== null && !(n[0] - self.me.x == 0 && n[1] - self.me.y == 0)){
          return self.move(n[0] - self.me.x,n[1] - self.me.y);
        }
        else{
          return null
        }
      }
      else{
        return action;
      }
    }
  }
}

export class PreacherManager {
  constructor(self) {
    this.mode_location = null;
    this.base_location = null;
    this.lattice_point = null;
    this.lattice_angle = 0;
    this.enemy_castles = []
    this.toSignal = true;

    this.base_is_castle = false
    const vis_map = self.getVisibleRobotMap()
    for (const dir of CIRCLES[2]) {
      if (self.map[self.me.y + dir[1]] && self.map[self.me.y + dir[1]][self.me.x + dir[0]]) {
        if (vis_map[self.me.y + dir[1]][self.me.x + dir[0]] > 0) {
          let r = self.getRobot(vis_map[self.me.y + dir[1]][self.me.x + dir[0]]);
          if (r.team == self.me.team && SPECS.UNITS[r.unit].SPEED == 0) { // castle or church
            this.base_location = [r.x, r.y];
            this.base_is_castle = (r.unit == SPECS.CASTLE)
            break;
          }
        }
      }
    }
  }

  turn(step, self) {
    for (const r of self.getVisibleRobots()) {
      this.enemy_castles = addCastle(self, r,this.enemy_castles)
      if (COMM16.type(r.signal) == COMM16.ENEMYCASTLE_HEADER) {
        this.mode = CONSTANTS.ATTACK
        this.mode_location = COMM16.DECODE_ENEMYCASTLE(r.signal)
      }
      if (COMM16.type(r.signal) == COMM16.ENEMYSIGHTING_HEADER){
        this.mode = CONSTANTS.ATTACK
        this.mode_location = COMM16.DECODE_ENEMYSIGHTING(r.signal)
      }
      if (COMM16.type(r.signal) == COMM16.LATTICE_HEADER){
        this.mode = CONSTANTS.LATTICE
        this.lattice_angle = COMM16.DECODE_LATTICE(r.signal)
      }
      if (COMM16.type(r.signal) == COMM16.HORDE_HEADER){
        this.mode = CONSTANTS.DEFENSE
        let tmpBaseloc = COMM16.DECODE_HORDE(r.signal);
        if (tmpBaseloc[0] != this.base_location[0] || tmpBaseloc[1] != this.base_location[1]){
          this.mode = CONSTANTS.PURSUING_BASE;
        }
        this.base_location = COMM16.DECODE_HORDE(r.signal)
      }
      if (COMM16.type(r.signal) == COMM16.ENEMYDEAD_HEADER){
        this.mode = CONSTANTS.LATTICE
        let tmp_loc = COMM16.DECODE_ENEMYDEAD(r.signal)
        let N = self.map.length
        let horiSym = isHorizontalSymmetry(self.map, self.fuel_map, self.karbonite_map)
        let enemyBaseLoc = horiSym ? [this.base_location[0], N - this.base_location[1] - 1] : [N - this.base_location[0] - 1, this.base_location[1]]
        if (dist(enemyBaseLoc, tmp_loc) == 0)
          this.toSignal = false;
      }
    }
    if (this.base_is_castle)
      signalDeadCastle(self, this.toSignal, this.base_location)
    let needLattice = false;
    if (this.mode == CONSTANTS.PURSUING_BASE){
      let action = defensive_behaviour_aggressive(self, this.mode_location, this.base_location, true)
      if (action == CONSTANTS.BASE_PURSUED){
        this.mode = CONSTANTS.DEFENSE
      }
      else{
        return action
      } 
    }
    if (this.mode == CONSTANTS.DEFENSE) {
      // self.log("here2")
      let action = defensive_behaviour_aggressive(self, this.mode_location, this.base_location)
      if (action == CONSTANTS.ELIMINATED_ENEMY){
        this.mode_location = null;
        needLattice = true;
      }
      if (action == CONSTANTS.SAVE_LATTICE){
        needLattice = true;
      }
      else{
        if (action !== null){
          return action
        }
        else{
          return null
        }
      }
    }

    if (this.mode == CONSTANTS.ATTACK && this.mode_location !== null) {
      let action = attack_behaviour_aggressive(self, this.mode_location);
      if (action == CONSTANTS.ELIMINATED_ENEMY) {
        // self.log("enemy castle dead")
        // self.castleTalk(COMM8.ENEMY_CASTLE_DEAD);
        this.mode = CONSTANTS.DEFENSE
        this.mode_location = null;
        return null
      } 
      else {
        return action
      }
    }

    if (this.mode == CONSTANTS.LATTICE || needLattice){
      let action = lattice_behaviour(self)
      if (action == CONSTANTS.SAVE_LATTICE){

        this.lattice_point = find_lattice_point(self, this.base_location, this.lattice_point, this.lattice_angle)

        //if we are already at the lattice point, then simply do nothing
        if (this.lattice_point !== null && self.me.x == this.lattice_point[0] && self.me.y == this.lattice_point[1]){
          this.lattice_point = null
          return null
        }

        let n = lattice_movement(self, this.base_location, this.lattice_point, this.lattice_angle);
        // self.log(""+n)
        if (n !== null && !(n[0] - self.me.x == 0 && n[1] - self.me.y == 0)){
          return self.move(n[0] - self.me.x,n[1] - self.me.y);
        }
        else{
          return null
        }
      }
      else{
        return action;
      }

    }
  }
}