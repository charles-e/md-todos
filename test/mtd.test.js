const mtd = require('../mtd.js');
const test = require('tape');
var testParams = {
  'numRecent': 3,
  'when': new Date(1)
};

test.skip('read three todos', t => {
  t.plan(1);
  const text =
    `- [ ] test 1
  - [ ] test 2
  - [x] test3`;
  var todoer = new mtd(testParams);
  const todos = todoer.findTasks(text, "test.md");
  t.equals(todos.length, 3);
});

test.skip('read three todos get status', async t => {
  t.plan(6);
  const text =
    `- [ ] test 1
  - [ ] test 2 (id:321)
  - [x] test3 (id:213)`;
  var todoer = new mtd(testParams);
  const todos = todoer.findTasks(text, "test.md");
  await todoer.markTasks(todos, text, "test.md");
  t.equals(todos[2].id, 1, 'id in first task');
  t.equals(todos[2].doneStamp, undefined, 'No stamp in first task');
  t.equals(todos[1].id, "321", 'id in second task');;
  t.equals(todos[1].doneStamp, undefined, 'no stamp in second task');;
  t.equals(todos[0].id, "213", 'id in third task');
  t.equals(todos[0].doneStamp, 1, 'doneStamp in third task');
});

test('read and tag a few new undated tasks', async t => {
  t.plan(2);
  var todoer = new mtd(testParams);
  const text =
    `- [ ] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3`;
  const todos = todoer.findTasks(text, "test.md");
  await todoer.markTasks(todos, text, "test.md");
  t.equals(todos[2].id, "123");
  t.equals(todos[0].id, "1");
});


test.skip('mark a new task', async t => {

  t.plan(1);
  var todoer = new mtd(testParams);
  todoer.writeHandler = async (text, fname) => {
    t.equals(text.length, origLen + addTag.length, "test add id tag")
  }

  const addTag = ' (id:1) (ok:1)'
  const text =
    `- [ ] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3 `; // (id:1) (ok:1)

  const origLen = text.length

  const todos = todoer.findTasks(text, "test.md");
  await todoer.markTasks(todos, text, "test.md");

});

test('read, tag and merge a few new undated tasks', async t => {

  t.plan(6);
  var todoer = new mtd(testParams);
  const addTag = ' (id:1) (ok:1)'

  const text =
    `- [ ] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3 `; // (id:1) (ok:1)
  const text2 =
    `- [ ] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3 (id:1) (ok:1)`;

  const origLen = text.length
  const len1 = origLen + addTag.length;

  const todos = todoer.findTasks(text, "test.md");
  todoer.writeHandler = async (text, fname) => {
    t.equals(text.length, len1, "check text len changed");
  }
  const tagged = await todoer.markTasks(todos, text, "test.md");

  await todoer.mergeTasks(tagged, text2, "test.md");
  var data = todoer.data;
  var done = todoer.doneMap;
  var pending = todoer.pendingMap;
  t.equals(pending.get("123").id, "uid-123", "verify pending id 0");
  t.equals(pending.get("234").id, "uid-234", "verify pending id 1");
  t.equals(done.get("1").id, "uid-1/0", "verify done id 0");
  t.equals(done.get("1").done, true, "verify new done");
  t.equals(pending.get("123").done, false, "verify pending 0");

});

var mtddata1 = {
  'numRecents': 3,
  'when': new Date(2),
  'taskData': {
    "pending": {
      'uid-123': {
        id: 'uid-123',
        done: false,
        source: 'test.md'
      },
      'uid-1/0': {
        id: 'uid-1/0',
        done: false,
        source: "test.md"
      }
    },
    "done": {
      'uid-234': {
        id: 'uid-234',
        done: false,
        source: "test.md"
      }
    },
    "tagged": {}
  }
};

test.skip('update one task to done', async t => {

  t.plan(7);
  var todoer = new mtd(mtddata1);

  const text =
    `- [x] test 1 #uid-123
  - [ ] test 2 #uid-234
  - [x] test3 #uid-1/0`;
  const todos = todoer.findTasks(text, "test.md");
  const tagged = await todoer.idTasks(todos, text, "test.md");
  await todoer.mergeTasks(tagged, text, "test.md");

  var data = todoer.data;
  var done = todoer.doneMap;
  var pending = todoer.pendingMap;
  t.equals(done.get("uid-123").id, "uid-123")
  t.equals(done.get("uid-1/0").id, "uid-1/0")
  t.equals(done.get("uid-1/0").done, true)
  t.equals(done.get("uid-123").done, true)
  t.equals(todoer.pendingList.length, 1);
  t.equals(todoer.doneList.length, 2);
  t.equals(done.get("uid-123").item, "test 1 #uid-123 #done-2");
})

test.skip('tagged tasks', async t => {

  t.plan(7);
  var todoer = new mtd(testParams);
  todoer.now = (new Date(2));
  const text =
    `- [ ] test 1 #uid-123
  - [ ] test 2 #uid-234
  - [x] test3 #tag`;

  const text2 =
    `- [ ] test 1 #uid-123
  - [ ] test 2 #uid-234
  - [x] test3 #tag #uid-2/0`;

  const origLen = text.length
  const len1 = origLen + " #uid-2/0".length;
  const len2 = len1 + " #done-2".length;

  const todos = todoer.findTasks(text, "test.md");
  todoer.writeHandler = async (text, fname) => {
    t.equals(text.length, len1, "check text len changed");
  }

  const tagged = await todoer.idTasks(todos, text, "test.md");
  todoer.writeHandler = async (txt, fname) => {
    t.true(txt.indexOf("done-2") >= 0, "has done tag");
    t.equals(txt.length, len2, "check text len changed again");
  }

  await todoer.mergeTasks(tagged, text2, "test.md");
  const tagMap = todoer.taggedMap;

  t.equals(tagMap.get("tag")[0].id, "uid-2/0", "verify tagged id 0");
  t.equals(tagMap.get("uid-123"),undefined, "no uid tags");
  t.equals(tagMap.get("uid-2/0"),undefined, "no uid tags");
  t.equals(tagMap.get("done-2"),undefined, "no uid tags");
//  t.skip(()=>{ var x = tagMap["uid-1/0").id},"foo", "no uid tags");
 // t.skip(()=>{ var x = tagMap["uid-123").id},"foo", "no uid tags");
});

var mtddata3 = {
  'numRecents': 3,
  'when': new Date(2),
  'taskData': {
    "pending": {
      'uid-123': {
        id: 'uid-123',
        done: false,
        source: 'test.md'
      },
      'uid-1/0': {
        id: 'uid-1/0',
        done: false,
        source: "test.md"
      },
      'uid-789' : {
        id : 'uid-789',
        done : false,
        source: "test2.md"
      }
    },
    "done": {
      'uid-234': {
        id: 'uid-234',
        done: true,
        source: "test.md",
      },
      'uid-777': {
        id: 'uid-777',
        done: true,
        source: "test2.md",
      }
    },
    "tagged": {
      'foo':[
       {
        id : 'uid-789',
        done : false,
        source: "test2.md"
      }
      ]
          
    }
  }
};

test.skip('delete from file', async t => {

  t.plan(6);
  var todoer = new mtd(mtddata3);
  todoer.now = (new Date(2));

  t.equals(todoer.pendingList.length, 3, "3 pending tasks before");
  t.equals(todoer.doneList.length,  2,"2 complete tasks before");
  t.equals(todoer.taggedMap.size,1, "1 tagged task before");
  todoer.deleteTasksFor("test.md");

  t.equals(todoer.pendingList.length, 1, "1 pending after");
  t.equals(todoer.doneList.length, 1, "1 done after");
  t.equals(todoer.taggedMap.size,0,"No tagged after");

});
