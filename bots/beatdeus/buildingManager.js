import {SPECS} from 'battlecode';
import {CIRCLES} from './constants.js'
import {dist, is_valid, getNearbyRobots, getClearLocations} from './utils.js'
import {COMM8} from './comm.js'
import {num_moves} from './path.js'

function isHorizontalSymmetry(pass_map, fuel_map, karb_map) {
  let N = pass_map.length;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < Math.floor(N/2); j++) {
      if (pass_map[j][i] != pass_map[N - j - 1][i] ||
          fuel_map[j][i] != fuel_map[N - j - 1][i] ||
          karb_map[j][i] != karb_map[N - j - 1][i]) {
        return false;
      }
    }
  }
  return true;
}

function determine_enemy_locations(horiSym, castle_locs, N) {
  let ret = [];
  for (const loc of castle_locs)
    ret.push(horiSym ? [loc[0], N - loc[1] - 1] : [N - loc[0] - 1, loc[1]])
  return ret;
}

function find_resource_clusters(map, fuel_map, karb_map) {
  // returns [{x: [], y: [], fuel: [], karb: []}, ...] where (x,y) is ideal church location
  // and fuel and karb return the counts of fuel and karbonite.

  let clusters = []

  let visited = new Set()
  let queue = [0]; // start at the top left
  let current, x, y, new_k, new_f, miniqueue, minicurrent, minix, miniy, churchx, churchy, foundvalidloc;

  while (queue.length > 0) {
    current = queue.shift()
    x = current&63
    y = (current&4032)>>6

    if (visited.has(current)){ continue; } // seen before.

    if (fuel_map[y][x] || karb_map[y][x]) { // bfs to find the entire cluster
      new_k = []
      new_f = []
      miniqueue = [current]
      while (miniqueue.length > 0) {
        minicurrent = miniqueue.shift();
        minix = minicurrent&63
        miniy = (minicurrent&4032)>>6

        if (visited.has(minicurrent)){ continue; }

        if (fuel_map[miniy][minix]) {
          new_f.push(minicurrent)
        } else if (karb_map[miniy][minix]){
          new_k.push(minicurrent)
        } else {
          continue; // don't continue exploring a non-fuel or karb. spot
        }

        visited.add(minicurrent);
        for (const dir of CIRCLES[8]) {
          if (is_valid(minix+dir[0], miniy+dir[1], map.length)) {
            miniqueue.push(((miniy+dir[1])<<6)|(minix+dir[0]));
          }
        }
      }

      // now that you've found the cluster, find the best spot to put a church:
      churchx = 0;
      churchy = 0;
      for (const spot of new_f) {
        churchx += (spot&63);
        churchy += ((spot&4032)>>6)
      }
      for (const spot of new_k) {
        churchx += (spot&63);
        churchy += ((spot&4032)>>6)
      }

      churchx = Math.floor(churchx / (new_f.length + new_k.length));
      churchy = Math.floor(churchy / (new_f.length + new_k.length));

      // search in a circle of radius 2 to find the best place to put the church:
      foundvalidloc = map[churchy][churchx] && (!fuel_map[churchy][churchx]) && (!karb_map[churchy][churchx]);
      if (!foundvalidloc) {
        for (let i = CIRCLES[4].length - 1; i >= 0; i--) {
          if (map[churchy + CIRCLES[4][i][1]] && map[churchy + CIRCLES[4][i][1]][churchx + CIRCLES[4][i][0]]) {
            if (!fuel_map[churchy + CIRCLES[4][i][1]][churchx + CIRCLES[4][i][0]]) {
              if (!karb_map[churchy + CIRCLES[4][i][1]][churchx + CIRCLES[4][i][0]]) {
                foundvalidloc = true;
                churchx += CIRCLES[4][i][0];
                churchy += CIRCLES[4][i][1];
                break;
              }
            }
          }
        }
      }

      if (foundvalidloc) {
        clusters.push({x:churchx, y:churchy, fuel:new_f.length, karbonite:new_k.length})
      }
    }

    visited.add(current) // mark as visited

    for (const dir of CIRCLES[1] ) {
      if (is_valid(x+dir[0], y+dir[1], map.length)) {
        queue.push(((y+dir[1])<<6)|(x+dir[0]));
      }
    }
  }

  return clusters;
}

function get_best_cluster(clusters, castle_locations) {
  let mean_x = 0;
  let mean_y = 0;

  for (const loc of castle_locations) {
    mean_x += loc[0];
    mean_y += loc[1];
  }

  mean_x = Math.floor(mean_x / castle_locations.length);
  mean_y = Math.floor(mean_y / castle_locations.length);

  // sort the array:
  clusters.sort(function(a, b) {
    if (a.fuel + a.karbonite > b.fuel + b.karbonite) {
      return -1; // a comes first;
    } else if (a.fuel + a.karbonite < b.fuel + b.karbonite) {
      return 1; // b comes first;
    } else if (Math.abs(a.fuel - a.karbonite) < Math.abs(b.fuel - b.karbonite)){
      return -1; // a has a batter ratio
    } else if (Math.abs(a.fuel - a.karbonite) < Math.abs(b.fuel - b.karbonite)){
      return 1; // b has a better ratio
    } else {
      return dist([a.x, a.y], [mean_x, mean_y]) > dist([b.x, b.y], [mean_x, mean_y]) ? 1 : -1;
    }
  })

  // then return the largest one:
  return clusters[0];
}

function get_best_castle(self, x, y, castle_locations) {
  let best_dist = null;
  let best_castle = null;

  let empty_vis_map = [...Array(self.map.length)].map(e => Array(self.map.length).fill(-1));

  for (const c of castle_locations) {
    let dist = num_moves(self.map, empty_vis_map, SPECS.UNITS[SPECS.PILGRIM].SPEED, [x,y], c);
    if (dist !== null) {
      if (best_dist === null || dist < best_dist) {
        best_dist = dist;
        best_castle = c;
      }
    }
  }

  return best_castle;
}


export class CastleManager {
  constructor(self) {
    self.log("CASTLE @ " + [self.me.x, self.me.y]);
    this.castle_locations = [];
    this.enemy_castle_locations = [];
    this.partial_points = [];

    this.horiSym = isHorizontalSymmetry(self.map, self.fuel_map, self.karbonite_map)

    this.castle_talk_queue = [COMM8.ENCODE_Y(self.me.y), COMM8.ENCODE_X(self.me.x)];
    this.signal_queue = [];
    this.build_queue = [];

    this.resource_clusters = find_resource_clusters(self.map, self.fuel_map, self.karbonite_map);
  }

  turn(step, self) {
    // RULE: NO PILGRIMS MAY BROADCAST LOCATIONS BEFORE STEP 2.

    if (step <= 2) {
      for (const r of self.getVisibleRobots()) {
        if (COMM8.type(r.castle_talk) == COMM8.X_HEADER) {
          this.partial_points[r.id] = COMM8.DECODE_X(r.castle_talk);
        } else if (COMM8.type(r.castle_talk) == COMM8.Y_HEADER) {
          this.castle_locations.push([this.partial_points[r.id], COMM8.DECODE_Y(r.castle_talk)])
        }
      }
    }

    if (step == 2) { // we've just gotten castle location information.
      this.enemy_castle_locations = determine_enemy_locations(this.horiSym, this.castle_locations, self.map.length);
      this.best_cluster = get_best_cluster(this.resource_clusters, this.castle_locations)

      if (this.best_cluster === undefined) {
        self.log("ERROR! BROKEN MAP.");
        return;
      }

      this.best_castle = get_best_castle(self, this.best_cluster.x, this.best_cluster.y, this.castle_locations);

      self.log("CASTLE @ " + this.best_castle + " SHOULD MINE @ " + [this.best_cluster.x, this.best_cluster.y]);
      self.log("F: " + this.best_cluster.fuel + ", K: " + this.best_cluster.karbonite);
    }

    // now, do any cached activities.
    if (this.castle_talk_queue.length > 0) {
      self.castleTalk(this.castle_talk_queue.pop()); // not performant: doesn't matter
    }

  }
}