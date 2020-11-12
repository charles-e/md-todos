const mtd = require('../mtd.js');
const test = require('tape');
var testParams = {
  'numRecent': 3,
  'when': new Date(1)
};

test('read three todos', t => {
  t.plan(1);
  const text =
    `- [ ] test 1
  - [ ] test 2
  - [x] test3`;
  var todoer = new mtd(testParams);
  const todos = todoer.findTasks(text, "test.md");
  t.equals(todos.length, 3);
});

test('read three todos get status', async t => {
  t.plan(6);
  const text =
    `- [ ] test 1
  - [ ] test 2 (id:321)
  - [x] test3 (id:213)`;
  var todoer = new mtd(testParams);
  const todos = todoer.findTasks(text, "test.md");
  await todoer.markTasks(todos, text, "test.md");
  t.equals(todos[2].id, "1", 'id in first task');
  t.equals(todos[2].doneStamp, undefined, 'No stamp in first task');
  t.equals(todos[1].id, "321", 'id in second task');
  t.equals(todos[1].doneStamp, undefined, 'no stamp in second task');
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


test('mark a new task', async t => {

  t.plan(1);
  var todoer = new mtd(testParams);
  todoer.writeHandler = async (text, fname) => {
    t.equals(text.length, origLen + addTag.length, "test add id tag");
  };

  const addTag = ' (id:1) (ok:1)';
  const text =
    `- [ ] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3 `; // (id:1) (ok:1)

  const origLen = text.length;

  const todos = todoer.findTasks(text, "test.md");
  await todoer.markTasks(todos, text, "test.md");

});

test('read, tag and merge a few new undated tasks', async t => {

  t.plan(6);
  var todoer = new mtd(testParams);
  const addTag = ' (id:1) (ok:1)';

  const text =
    `- [ ] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3 `; // (id:1) (ok:1)
  const text2 =
    `- [ ] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3 (id:1) (ok:1)`;

  const origLen = text.length;
  const len1 = origLen + addTag.length;

  const todos = todoer.findTasks(text, "test.md");
  todoer.writeHandler = async (text, fname) => {
    t.equals(text.length, len1, "check text len changed");
  };
  const tagged = await todoer.markTasks(todos, text, "test.md");

  await todoer.mergeTasks(tagged, text2, "test.md");
  var data = todoer.data;
  var done = todoer.doneMap;
  var pending = todoer.pendingMap;
  t.equals(pending.get("123").id, "123", "verify pending id 0");
  t.equals(pending.get("234").id, "234", "verify pending id 1");
  t.equals(done.get("1").id, "1", "verify done id 0");
  t.equals(done.get("1").done, true, "verify new done");
  t.equals(pending.get("123").done, false, "verify pending 0");

});

var mtddata1 = {
  'numRecents': 3,
  'when': new Date(2),
  'taskData': {
    "pending": {
      '123': {
        id: '123',
        done: false,
        source: 'test.md'
      },
      '1': {
        id: '1',
        done: false,
        source: "test.md"
      }
    },
    "done": {
      '234': {
        id: '234',
        done: false,
        source: "test.md"
      }
    },
    "tagged": {}
  }
};

test('update one task to done', async t => {

  t.plan(7);
  var todoer = new mtd(mtddata1);

  const text =
    `- [x] test 1 (id:123)
  - [ ] test 2 (id:234)
  - [x] test3 (id:1)`;
  const todos = todoer.findTasks(text, "test.md");
  const tagged = await todoer.markTasks(todos, text, "test.md");
  await todoer.mergeTasks(tagged, text, "test.md");

  var data = todoer.data;
  var done = todoer.doneMap;
  var pending = todoer.pendingMap;
  t.equals(done.get("123").id, "123");
  t.equals(done.get("1").id, "1");
  t.equals(done.get("1").done, true);
  t.equals(done.get("123").done, true);
  t.equals(todoer.pendingList.length, 1);
  t.equals(todoer.doneList.length, 2);
  t.equals(done.get("123").item, "test 1 (id:123) (ok:2)");
});

var mtddata3 = {
  'numRecents': 3,
  'when': new Date(2),
  'taskData': {
    "pending": {
      '123': {
        id: '123',
        done: false,
        source: 'test.md'
      },
      '1': {
        id: '1',
        done: false,
        source: "test.md"
      },
      '789' : {
        id : '789',
        done : false,
        source: "test2.md"
      }
    },
    "done": {
      '234': {
        id: '234',
        done: true,
        source: "test.md",
      },
      '777': {
        id: '777',
        done: true,
        source: "test2.md",
      }
    },
    "tagged": {
      'foo':[
       {
        id : '789',
        done : false,
        source: "test2.md"
      }
      ]
          
    }
  }
};

test('delete from file', async t => {

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
