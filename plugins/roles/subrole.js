var self = this;

var fs = require('fs');

const rolesPath = './plugins/roles/_roles.json';
const subRoleUsage = '`subrole new <role>` | create a new subrole\n'
    + '`subrole list <group>` | list subroles in a group\n'
    + '`subrole add <group>:<role>` | add a subrole to a group\n'
    + '`subrole remove <group>:<role>` | remove a subrole from a group';

self.logger = null;
self.config;
self.subRolesData = null;
self.commands = [
    { name: 'new', process: subRoleNew },
    { name: 'list', process: subRoleList },
    { name: 'add', process: subRoleAdd },
    { name: 'remove', process: subRoleRemove }
];

exports.usage = subRoleUsage;

exports.init = function(config, logger) {
    self.config = config.roles;
    self.logger = logger;

    if (!fs.existsSync(rolesPath)) {
        self.logger.log('found no subroles data, creating...', 'subrole');
        createRolesFile();
    }
}

exports.process = function(message, args) {
    if (args.length < 2) {
        subRoleHelp(message.member);
        return;
    }

    var command = self.commands
        .find(c => c.name == args[0]);

    if (!command) {
        subRoleHelp(message.member);
        return;
    }

    command.process(message, args.slice(1).join(' '));
}

function subRoleHelp(member) {
    member.send(subRoleUsage)
        .catch(e => self.logger.error(e, 'subrole'));
}

function subRoleNew(message, argStr) {
    modifyData(d => {
        var id = 0;

        if (d.subRoles.find(sr => sr.name == argStr)) {
            self.logger.error('unable to create subrole: already exists', 'sr new');    
            return;
        }

        if (d.subRoles.length) {
            var ids = d.subRoles.map(sr => sr.id);
            id = Math.max(...ids) + 1;
        }

        var subRole = {
            id: id,
            name: argStr
        };

        d.subRoles.push(subRole);
        self.logger.log('created new subrole: ' + subRole.name, 'sr new');
        console.log(d.subRoles);
    });
}

function subRoleList(message, argStr) {
    self.logger.log('subrole list');
}

function subRoleAdd(message, argStr) {
    self.logger.log('subrole add');
}

function subRoleRemove(message, argStr) {
    self.logger.log('subrole remove');
}

function createRolesFile() {
    var data = {
        groups: self.config.roles.map(r => {
            return {
                id: r.id,
                name: r.name,
                subRoleIds: []
            };
        }),
        subRoles: []
    };

    fs.writeFile(rolesPath, JSON.stringify(data), 'utf8', e => {
        if (e) {
            self.logger.error(e, 'subrole');
            return;
        }    

        self.logger.log('created subrole data file', 'subrole');
    });
}

function readData(read) {
    fs.readFile(rolesPath, 'utf8', (e, data) => {
        if (e) {
            self.logger.error(e, 'sr read');
            return;
        }

        read(JSON.parse(data));
    });
}

function modifyData(modify) {
    readData(o => {
        modify(o);
        console.log(o);

        fs.writeFile(rolesPath, JSON.stringify(o), 'utf8', e => {
            if (e) {
                self.logger.error(e, 'sr write');
                return;
            }

            self.logger.log('saved subrole data', 'sr mod');
        });
    });
}