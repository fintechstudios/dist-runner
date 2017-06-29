# dist-runner
Execute a command for every item in a path and pass each as the `DISTRIBUTION` environment variable.

The current distribution can be accessed within child processes from `process.env.DISTRIBUTION`.

Often a unique port is needed, so `process.env.DIST_PORT` is passed to child processes for convenience 
(counts up from 8080)


## Usage

`dist-runner -c <command>` is the very least that you can do.

Flags:
 - `-c, --cmd <command>` - command to execute (required)
 - `-f, --folder <folder>` - folder to source distributions from, defaults to `configs/distributions`
 - `-d, --skip <list>` - comma-separated list of distributions to skip
 - `-b, --batch <n>` - sets the async batch size to `<n>`, defaults to all
 - `-s, --sync` - disable async mode
 - `-v, --verbose` - pipe stdout to the console
 - `-V, --version` - version information
 - `-h, --help` - display command information
 
Example:
 - `dist-runner -c "yarn run test:dist"` - will run a the test suite for every config in `configs/distributions`

