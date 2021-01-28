#! /usr/bin/env node

import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import process from 'process';

const notebookDirs = {};
if (fs.existsSync('notes-info.json')) {
	const directory = process.cwd().split(/\//g);
	notebookDirs[directory[directory.length - 1]] = process.cwd();
}
const cwdDir = fs.readdirSync(process.cwd());
cwdDir.forEach((dir) => {
	if (fs.lstatSync(path.join(process.cwd(), dir)).isDirectory()) {
		const fileCheck = fs.readdirSync(dir);
		if (fileCheck.includes('notes-info.json')) {
			notebookDirs[dir] = path.join(process.cwd(), dir);
		}
	}
});

function getDate() {
	const currentDate = new Date();
	const day = currentDate.getDate();
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const month = months[currentDate.getMonth()];
	const year = currentDate.getFullYear() % 100;
	return `${day}${month}${year}`;
}

function notebookMd({ notebookName }) {
	return `# ${notebookName}

Make a note in each of your classes with \`note-cli\`!

`;
}

async function defaultNotepageTemplate({ notebookName }) {
	return fs.readFileSync('note-template.md', 'utf8').replace(/%NOTEBOOK_NAME%/, notebookName);
}

async function initialConfig() {
	// If it's an initial config setup
	const answers = await inquirer.prompt([{
			type: 'input',
			name: 'notebookName',
			message: 'What would you like to name the notebook?',
			default: 'Notebook',
			transformer: (input) => input.replace(/ /g, '-'),
			validate: (input) => /^[\w\s-]+$/.test(
				input.replace(/ /g, '-') ? true : 'Invalid Notebook Name!',
			),
		},
		{
			type: 'input',
			name: 'classes',
			message: 'Enter the classes that you have, separated by commas (,)?',
			default: 'class1,class2,class3',
			transformer: (input) => input.replace(/ /g, '-').replace(/,[-]+/g, ', '),
			validate: (input) => {
				let output = true;
				input
					.replace(/,[ ]+/g, ',')
					.replace(/ /g, '-')
					.split(',')
					.forEach((s) => {
						output *= /^[\w\s-]+$/.test(s);
					});
				return output ? true : 'Invalid Class Name(s)!';
			},
		},
		{
			type: 'input',
			name: 'fileExtension',
			message: 'What extension for your note files?',
			default: 'md',
		},
		{
			type: 'confirm',
			name: 'noteTemplate',
			message: 'Would you like to make a template for your notes?',
			default: true,
		},
	]);

	answers.notebookName = answers.notebookName.replace(/ /g, '-');
	answers.classes = answers.classes.replace(/,[ ]+/g, ',').replace(/ /g, '-');

	if (!fs.existsSync(answers.notebookName)) {
		fs.mkdirSync(answers.notebookName);
	}

	const classes = answers.classes.split(',');
	const classDirs = classes.map((className) => path.join(answers.notebookName, className));
	const outJson = {
		classes,
		class_dirs: classDirs,
		notebookName: answers.notebookName,
		file_extension: answers.fileExtension,
	};

	classDirs.forEach((dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
	});

	fs.writeFileSync(path.join(answers.notebookName, `${answers.notebookName}.md`), notebookMd({
		notebookName: answers.notebookName,
	}), 'utf8');

	if (answers.noteTemplate) {
		fs.writeFileSync(path.join(answers.notebookName, 'note-template.md'), await defaultNotepageTemplate(answers), 'utf8');
	}

	fs.writeFileSync(path.join(answers.notebookName, 'notes-info.json'), JSON.stringify(outJson, null, 4), 'utf8');

	process.exit(0);
}

async function newNote(nbName, options) {
	// If it's for a new note
	// console.log(answers);

	const answers = await inquirer.prompt([{
			type: 'list',
			name: 'className',
			message: 'What class would you like to make your note in?',
			choices: () => {
				if (process.cwd().endsWith(nbName)) {
					return fs.readdirSync('./').filter((str) => fs.lstatSync(path.join('./', str)).isDirectory());
				}
				return fs.readdirSync(nbName).filter((str) => fs.lstatSync(path.join(nbName, str)).isDirectory());
			},
		},
		{
			type: 'input',
			name: 'noteName',
			message: 'What would you like to call this note?',
			transformer: (input) => `${input}.${options.file_extension}`,
			default: `Note_${getDate()}.${options.file_extension ? options.file_extension : 'md'}`,
		},
	]);

	const filePath = path.join(options.path, answers.className);
	let prefix = 0;
	let fileName = +prefix !== 0 ? prefix + answers.noteName : answers.noteName;
	while (fs.readdirSync(filePath).includes(fileName)) {
		prefix += 1;
		fileName = +prefix !== 0 ? prefix + answers.noteName : answers.noteName;
	}
	if (fs.existsSync(path.join(options.path, 'note-template.md'))) {
		const templateText = fs.readFileSync(path.join(options.path, 'note-template.md'), 'utf8');
		fs.writeFileSync(path.join(filePath, fileName), templateText, 'utf8');
	} else {
		fs.writeFileSync(path.join(filePath, fileName), '', 'utf8');
	}

	// fs.writeFileSync(path.join(options.path), )
}

async function main() {
	const answers = await inquirer.prompt([{
		type: 'list',
		name: 'notebookName',
		message: 'What notebook would you like make your new note in?',
		choices: [...Object.keys(notebookDirs), 'New Notebook'],
	}]);

	if (answers.notebookName === 'New Notebook') {
		await initialConfig();
	} else {
		const file = fs.readFileSync(path.join(notebookDirs[answers.notebookName], 'notes-info.json'), 'utf8');
		const options = JSON.parse(file);
		options.path = notebookDirs[answers.notebookName];
		await newNote(answers.notebookName, options);
	}
}

main();
