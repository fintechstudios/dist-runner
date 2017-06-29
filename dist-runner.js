'use strict';

const program = require('commander');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

function list(val) {
  return val.split(',');
}

function getVersion() {
  return require('./package.json').version;
}

program
  .version(getVersion())
  .option('-c, --cmd <command>', 'command to execute (required)')
  .option('-f, --folder <folder>', 'the folder to source distributions from, defaults to ./configs/distributions')
  .option('-d, --skip <list>', 'comma-separated list of distributions to skip', list)
  .option('-b, --batch <n>', 'set async batch size to <n>, defaults to all')
  .option('-s, --sync', 'disable async mode')
  .option('-v, --verbose', 'pipe stdout to the console')
  .description(
    'Execute a command for every item in a path and pass each as the DISTRIBUTION environment variable\n' +
    '  The current distribution can be accessed from `process.env.DISTRIBUTION`\n' +
    '  Often a unique port is needed, so `process.env.DIST_PORT` is passed for convenience (counts up from 8080) \n' +
    '  Examples:\n' +
    '      dist-runner -c "yarn run test:dist" -- will run a test suite for each distribution config')
  .parse(process.argv);

const CMD = program.cmd;
if (!CMD) {
  console.error('Command is required');
  program.help();
}

const DIST_CONFIGS_FOLDER = program.folder || path.normalize('configs/distributions');
const DISTRIBUTIONS = fs.readdirSync(DIST_CONFIGS_FOLDER);
const SKIP = program.skip || [];
const BATCH_SIZE = (program.batch && program.batch < DISTRIBUTIONS.length) ? program.batch : DISTRIBUTIONS.length;
const IS_SYNC = program.sync;
const VERBOSE = program.verbose;
const NUM_DISTS = DISTRIBUTIONS.length - SKIP.length;





let final_exit_code = 0;
const nonzero_exits = [];

function get_port(dist) {
  return 8080 + DISTRIBUTIONS.indexOf(dist);
}

const TIMER_SUFFIX = '-run-time';
function startTimer(dist, noLog) {
  if (!noLog) {
    console.log(
      'START dist<\x1b[36m' + dist + '\x1b[37m>, ' +
      'port<\x1b[36m' + get_port(dist) + '\x1b[37m>'
    );
  }
  console.time(dist + TIMER_SUFFIX);
}
function stopTimer(dist) {
  console.timeEnd(dist + TIMER_SUFFIX);
}

function makeChildEnv(dist) {
  const env = Object.create(process.env);
  env.DISTRIBUTION = dist;
  env.DIST_PORT = get_port(dist);
  return env;
}

function end_runner() {
  stopTimer('full-suite');
  if (nonzero_exits.length > 0) {
    console.error("The following distributions had a non-zero exit code:");
    console.error(nonzero_exits.join(', '))
  }
  process.exit(final_exit_code);
}





startTimer('full-suite', true);

if (IS_SYNC) {  // using execSync pipes output differently
  DISTRIBUTIONS.forEach(function(dist, i) {
    if (SKIP.indexOf(dist) >= 0) {
      return;
    }
    startTimer(dist);
    let stdout;
    let code = 0;

    try {
      stdout = child_process.execSync(CMD, {
        env: makeChildEnv(dist, i),
        stdio: VERBOSE ? 'inherit' : 'pipe'
      })
    } catch(e) {  // execSync will throw an error on non-zero exit
      stdout = e.stdout;
      code = e.status;
      if (e.error) { console.error(e.error); }
      if (e.stderr) { console.error(e.stderr); }
    }
    if (VERBOSE && stdout) {
      console.log(stdout);
    }

    if (code > final_exit_code) {
      final_exit_code = code;
    }
    if (code > 0) {
      nonzero_exits.push(dist);
    }

    stopTimer(dist);
  });

  end_runner();
}

let completed = 0;
let nextDistIndex = 0;

function runNextAsync() {
  let dist = DISTRIBUTIONS[nextDistIndex++];
  if (SKIP.indexOf(dist) >= 0) {
    return;
  }
  startTimer(dist);

  const child = child_process.exec(
    CMD,
    {env: makeChildEnv(dist, nextDistIndex-1)},
    function(err, stdout, stderr) {  // callback
      console.log('\n\n\n\n\n');
      console.log('\x1b[36m## ' + dist + ' #############################################\x1b[37m');
      stopTimer(dist);
      if (err) { console.log('err:' + dist + ":" + err); }
      if (stderr) { console.log('stderr:' + dist + ":" + stderr); }
      if (VERBOSE) {
        console.log('Output for ' + dist + ":");
        console.log(stdout);
      }
  });
  child.on('exit', function(code) {
    completed++;
    console.log('Exited dist `' + dist + '` with code ' + code);
    if (code > final_exit_code) {
      final_exit_code = code;
    }
    if (code > 0) {
      nonzero_exits.push(dist);
    }
    if (completed >= NUM_DISTS) {  // last build
      setTimeout(end_runner, 1200);
    }
    else if (nextDistIndex < NUM_DISTS) {
      runNextAsync();
    }
  })
}

// start async execution
for (let i = 0; i < BATCH_SIZE; i++) {
  runNextAsync();
}
