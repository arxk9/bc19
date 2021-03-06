import {BCAbstractRobot, SPECS} from 'battlecode';
import {CastleManager} from './buildingManager.js';
import {PreacherManager} from './attackManager.js'

class NoneManager {turn(step, self){return null}}

let step = -1;
let robotManager = null;

class MyRobot extends BCAbstractRobot {
  turn() {
    step++;
    let self = this; // use self instead of this, since this gets overridden inside functions.

    if (robotManager === null) { // When we don't have an existing manager
      if (self.me.unit === SPECS.CASTLE) {
        robotManager = new CastleManager(self);
        // robotManager = new NoneManager();
      } else if (self.me.unit === SPECS.PREACHER) {
        robotManager = new PreacherManager(self);
        //robotManager = new NoneManager();
      }
    }

    // now, just obey the manager;
    let action = robotManager.turn(step, self);
    if (action === null) {
      return;
    } else {
      return action;
    }
  }
}

var robot = new MyRobot();