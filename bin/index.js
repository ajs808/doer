#! /usr/bin/env node

/**
 * Import third party packages
 */
const chalk = require('chalk');
const uuid = require('uuid/v4');
const axios = require('axios');
const minimist = require('minimist');
const ora = require('ora');
const Table = require('easy-table');
const config = require('../config')
const TODOIST_TOKEN = config.key;
//TODO: figure out a more elegant way of doing this

/**
 * App has started, notify the user
 */
console.log();
console.log(chalk.red('Todoist CLI'));
console.log();

/**
 * In order to do anything we must first have a valid API token, let's try and find one.
 */
const token = TODOIST_TOKEN;
if (!token) {
  console.log(chalk.red.bold('API token not set.'));
  console.log(
    'Please add a valid token to your environment as `TODOIST_TOKEN`, eg. by running `export TODOIST_TOKEN="MY_API_TOKEN"`.'
  );
  //need to edit ~/.bashrc
  console.log(
    'You can find your token at: https://todoist.com/prefs/integrations.'
  );
  process.exit(1);
}

/**
 * access todoist API
 */
const api = axios.create({
  baseURL: 'https://api.todoist.com/rest/v1/',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer ' + token, 'X-Request-Id': uuid(),
    'Content-Type': 'application/json'
  },
  responseType: 'json'

});

async function getProjects() {
  const { data } = await api.get('projects');
  return data;
}

async function listProjects() {
  let projects = await getProjects();
  projects.forEach(project => {
    console.log(project.name);
  });
}

// async function deleteItems(opts) {
//   const spinner = ora('Fetching task IDs').start();
//   try {
//     let data = await getItems(opts, spinner);
//     spinner.info(`${data.length} tasks(s) to delete`);
//     for (const task of data) {
//       try {
//         await api.delete('tasks/' + task.id);
//         spinner.info(`Deleted ${task.id}.`);
//       } catch (e1) {
//         spinner.warn(`Could not delete ${task.id}: ${e1}`);
//       }
//       break;
//     }
//   } catch (e) {
//     spinner.fail(`${e}`);
//   }
// }

async function deleteItem(opts, itemNumber) {
  const spinner = ora('Fetching task IDs').start();
  try {
    let data = await getItems(opts, spinner);
    if(itemNumber < 0 || itemNumber >= data.length){
    	spinner.fail(`Not a valid item number`);
    }
    else{
    	spinner.info(`Deleting task ${itemNumber}`);
    	try {
    		await api.delete('tasks/' + data[itemNumber].id);
    		spinner.info(`Deleted task ${itemNumber}(${data[itemNumber].id}).`);
    	} catch (e1) {
    		spinner.warn(`Could not delete ${data[itemNumber].id}: ${e1}`);
    	}
    }
  } catch (e) {
    spinner.fail(`${e}`);
  }
}

//TODO: fix method
async function completeItem(opts, itemNumber) {
  const spinner = ora('Fetching task IDs').start();
  try {
    let data = await getItems(opts, spinner);
    if(itemNumber < 0 || itemNumber >= data.length){
      spinner.fail(`Not a valid item number`);
    }
    else{
      spinner.info(`Completing task ${itemNumber}`);
      try {
        await api.put('tasks/' + data[itemNumber].id, {"checked":1});
        spinner.info(`Completed task ${itemNumber}(${data[itemNumber].id}).`);
      } catch (e1) {
        spinner.warn(`Could not complete ${data[itemNumber].id}: ${e1}`);
      }
    }
  } catch (e) {
    spinner.fail(`${e}`);
  }
}


async function resolveProject(projectName) {
  const projects = await getProjects();
  const project = projects.find(p => p.name.localeCompare(projectName, undefined, { sensitivity: 'base' }) == 0);
  if (project == null) return 0;
  return project.id;
}

async function getItems({ projectName }, spinner) {
  if (typeof spinner === 'undefined') spinner = ora('Fetching tasks').start();

  let { data } = await api.get('tasks');
  spinner.succeed('Fetched tasks!');
  console.log();
  if (projectName) {
    spinner.text = `Resolving project '${projectName}'`;
    const projectId = await resolveProject(projectName);
    if (projectId == 0) {
      spinner.fail(`Project '${projectName}' not found.`);
      return [];
    } else {
      spinner.text = 'Filtering by project';
      data = data.filter(p => (p.project_id == projectId));
    }
  }
  return data;

}

async function listItems(opts) {
  const spinner = ora('Fetching tasks').start();
  try {
    let data = await getItems(opts, spinner);
    
    var t = new Table;
    var i = 0;
    data.forEach(function(item) {
    	var dueDate;
    	if(item.due == undefined){
      		dueDate = "No due date";
      	}     
      	else{
      		dueDate = item.due.date;
      	}
      	
      	t.cell('No.',i);
    	t.cell(chalk.blue('Task ID'),chalk.blue(item.id));
    	t.cell(chalk.green('Due Date'),chalk.green(dueDate));
    	t.cell(chalk.cyan('Task'),chalk.cyan(item.content));
    	t.newRow();
    	i++;
    })
    console.log(t.toString());
    console.log();
    console.log(chalk.red(`You currently have ` + i + ` tasks`));
    console.log();
  } catch (e) {
    spinner.fail(`${e}`);
  }

}

async function addTask(task, opts) {
  const spinner = ora('Creating task').start();

  // Add project id if specified
  if (opts.projectName) {
    spinner.text = `Resolving ${opts.projectName}`;
    let projectId = await resolveProject(opts.projectName);
    if (projectId == 0) {
      spinner.fail(`Project '${opts.projectName}' not found.`);
      return;
    }
    spinner.text = 'Resolved project';
    task.project_id = projectId;
  }

  // Post task
  spinner.text = 'Posting task';
  try {
    let { data } = await api.post('tasks', task);
    spinner.succeed('Posted!');
  } catch (e) {
    spinner.fail(`${e}`);
    // if (e.response) {
    //   console.log(e.response.data);
    //   console.log(e.response.headers);
    // }
    // console.log(task);
    return;
  }
  process.exit();
}

/**
 * The user should now be able to choose what they would like to do. 
 * Let's ensure that we've got a valid set or arguments being passed and guide the user accordingly.
 */
const argv = minimist(process.argv.slice(2));

let opts = {
  projectName: argv['project'] || argv['p']
}

switch (true) {
  case Boolean(argv['projects']):
    listProjects();
    break;
  case Boolean(argv['list'] || argv['l']):
    listItems(opts);
    break;
  case Boolean(argv['deleteAll']):
    deleteItems(opts);
    break;
  case Boolean(argv['delete']):
  	deleteItem(opts, argv['delete']);
  	break;
  case Boolean(argv['complete']):
    completeItem(opts, argv['complete']);
    break;
  case Boolean(argv['add']):
    let task = {};
    if (Boolean(argv['d]'] || argv['due'])) {
      task['due_string'] = argv['d'] || argv['due'];
    }
    task['content'] = argv['add'];
    addTask(task, opts);
    break;
  default:
    const helpText = `
  A Todoist CLI client
  
  commands:
    --add     -a    Add a task
    --list    -l    List tasks
    --projects      List projects
    --deleteAll     Delete all tasks (or all tasks in specified project)
    --delete		    Delete the task with the inputted task number (not ID)
    --complete      Complete the task with the inputted task number

  options:
    --due     -d    A date string, eg. tomorrow, 'every day @ 10'
    --project -p    Filters task list, or sets project when adding a new task

  example:
    doer --due sunday --add "Walk the dog"
    doer --list --project "Shopping"
  `;
    console.log(helpText);

}
