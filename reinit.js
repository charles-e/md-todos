// a tool to  make todos in my obsidian journal
//
//

const {
  Command
} = require("commander");
const toml = require("toml");
const moment = require("moment");
const fs = require("fs");

const fsPromises = fs.promises;

const path = require("path");
const {
  findAll,
  findTags
} = require("./todosearch");
const {
  basename
} = require("path");
const GENDIR = "_Generated";
const mtd = require("./mtd");

var baseLoc = `${process.env.HOME}/DropBox/Journal`;

var when = moment(Date.now()); // when is a moment object
console.log(when);

const prog = new Command();

prog.version('0.0.1');
prog.option('-d, --debug', 'output extra debugging')
  .option('-D, --dir <directory>', 'search in directory')
  .option('-W --watch');

prog.parse(process.argv);
if (prog.dir) {
  console.log('-Dir ' + prog.dir);
  baseLoc = prog.dir;
}

baseLoc = path.normalize(baseLoc);

console.log(baseLoc);
var configDir = process.env.MARKTODO_CONFIGDIR;
if (!configDir) {
  configDir = `${process.env.HOME}/.config/marktask`;
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }
}
const configLoc = `${configDir}/config.toml`;
const cacheLoc = `${configDir}/cache.json`;


console.log(`configLoc ${configLoc}`);
const config = fs.existsSync(configLoc) ? toml.parse(fs.readFileSync(configLoc, 'utf-8')) : {};
if (config.baseDir) {
  baseLoc = config.baseDir;
  if (!baseLoc.startsWith("/")) {
    baseLoc = path.join(process.env.HOME, baseLoc);
  }
}
const datefmt = config.dateFmt ?? "YYYY-MM-DD";
genDir = config.genDir ?? GENDIR;
const genLoc = path.join(baseLoc, genDir);
const dotLoc = path.join(baseLoc, '.obsidian');

const taskapi = new mtd({
  "baseLoc": baseLoc,
  "genLoc": genLoc,
});

taskapi.writeHandler = async (text, fpath) => {
  await fsPromises.writeFile(fpath, text);
};

const readPath = async (dirLoc) => {

  let dirInfo;
  try {
    const dirPath = path.join(baseLoc, dirLoc);
    dirInfo = await fs.promises.opendir(dirPath);
  } catch (err) {
    console.log(err);
  }
  if (dirInfo === undefined) {
    console.log("undefined");
  }
  for await (const dirent of dirInfo) {
    const fPathRelative = path.join(dirLoc, dirent.name);
    const fPath = path.join(baseLoc, fPathRelative);
    const fname = dirent.name.slice(0, -3);
    if (dirent.isFile() && dirent.name.endsWith(".md") && watchedPath(fPath)) {
      var stats;
      try {
        const fd = fs.openSync(fPath);
        stats = fs.fstatSync(fd);
        fs.closeSync(fd);
      } catch (e) { 
         console.log(`error opening ${fPath}: ${e}`)
      }
      var lastTouch;

      let text;
      try{
         text = fs.readFileSync(fPath, "utf8");
      }catch(e){
         console.log(`error reading ${fPath}: ${e}`)
      }
      const tasksPath = path.join(dirLoc, fname);
      todos = taskapi.findTasks(text, fPath);
      taskapi.stamp = Date.now();
      console.log(fname);
      if (todos.length > 0) {
        const dated = moment(fname, datefmt);
        var byDate;
        if (dated.isValid() && dated.year() > 2000) {
          taskapi.now = dated.unix();
        } else {
          taskapi.now = stats.ctime.getTime();
        }
        console.log(`count = ${todos.length}`);
        try {
          taskapi.markTasks(todos, text, fPath);
        } catch(err){
          console.log(`error processing ${fPath}`);
        }
      }

    } else if (dirent.isDirectory() && dirent.name !== genDir) {
      // don't bother with the generated directory
      // otherwise recurse to subdirs
      const dir = path.join(dirLoc, dirent.name);
      readPath(dir);
    }
  }
};


var ignoreDirs = [genLoc, dotLoc];
if (config.ignoreDirs) {
  for (const dir in config.ignoreDirs)
    ignoreDirs.push(path.join(baseLoc, config.ignoreDirs[dir]));
}

console.log(`ignoreDirs: ${ignoreDirs}`);
watchedPath = (fpath) => {
  for (const id in this.ignoreDirs) {
    if (fpath.startsWith(this.ignoreDirs[id])) {
      return false;
    }
  }
  return true;
};

const main = async () => {
  console.log(`run against: ${baseLoc}`);
  await readPath(".");

};
main();
