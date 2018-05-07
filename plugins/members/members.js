var self = this;

var Discord = require('discord.js'),
    fs = require('fs');

var logChannelName = 'member-log';
var contestChannelName = 'contest-entry-log'
var welcomeTextPath = './plugins/members/welcome.md';
var rulesTextPath = './plugins/members/rules.md';
var welcomeText;

self.client = null;
self.config = null;
self.logger = null;

exports.commands = [
    'rules',
    'members',
    'memberlist',
    'avatar',
    'joined',
    'contest'
];

exports.init = function (context) {
    self.client = context.client;
    self.config = context.config;
    self.logger = context.logger;

    if (!fs.existsSync(welcomeTextPath)) {
        self.logger.log("The file " + welcomeTextPath + " does not exist. This may cause command responses.")
    }
    else {
        fs.readFile(welcomeTextPath, 'utf8', (err, data) => {
            if (err) {
                self.logger.error(err);
                return;
            }
            welcomeText = data;
        });
    }
    if (!fs.existsSync(rulesTextPath)) {
        self.logger.log("The file " + rulesTextPath + " does not exist. This may cause command responses.")
    }

    self.client.on('guildMemberAdd', memberAdd);
    self.client.on('guildMemberRemove', memberRemove);
}

// Commands
exports['members'] = {
    usage: 'Gets how many people are on the server',
    process: function (message) {
        message.channel.send("There are currently **" + message.guild.memberCount + "** members on this server.");
    }
}

exports['memberlist'] = {
    usage: 'List of server members by role',
    process: function (message) {
        var rolesConfig = self.config.roles;

        message.channel.send('Generating memberlist...')
            .then(m => {
                reply = `There are currently **${message.guild.memberCount}** members on this server\n`;

                var serverRoles = message.guild.roles
                    .filter(r => r != '@everyone');

                for (var i = 0; i < rolesConfig.roles.length; i++) {
                    var role = message.guild.roles.find('name', rolesConfig.roles[i].name);
                    if(!role) {
                        self.logger.log('could not find role on server: ' + rolesConfig.roles[i].name, 'memberlist');
                        continue;
                    }
                    reply += `**${role.name}**: ${role.members.keyArray().length}\n`;
                }

                message.channel.send(reply)
                    .then(_ => m.delete())
                    .catch(e => self.logger.error(e, 'memberlist'));
            })
            .catch(e => self.logger.error(e, 'memberlist'));
    }
}

exports['avatar'] = {
    usage: 'Sends author his avatar',
    process: function (message, args) {
        var embed = new Discord.RichEmbed()
            .setColor(parseInt(self.config.embedCol, 16))
            .setDescription('[Direct Link](' + message.author.avatarURL + ')')
            .setImage(message.author.avatarURL)
            .setFooter(new Date())
            .setAuthor(message.author.tag, message.author.avatarURL);

        message.reply('your avatar:');
        message.channel.send({ embed: embed })
            .catch(self.logger.error);
    }
}

exports['rules'] = {
    usage: 'DM the user with rules',
    process: function (message, args) {
        fs.readFile(rulesTextPath, 'utf8', (err, data) => {
            if (err) {
                self.logger.error(err);
                return;
            }

            var embed = new Discord.RichEmbed()
                .setColor(parseInt(self.config.embedCol, 16))
                .setTitle('Rules')
                .setDescription(data)
                .setFooter(new Date())
                .setAuthor(self.client.user.username, self.client.user.avatarURL);

            message.reply('rules have been sent.')
                .then(m => m.delete(5000))
                .catch(self.logger.error);

            message.author.send({ embed: embed })
                .catch(self.logger.error);
        });
    }
}

exports['joined'] = {
    usage: "Gets author's date and time of arrival on the server",
    process: function (message, args) {
        var member = message.channel.guild.fetchMember(message.author)
            .then(member => {
                var date = member.joinedAt;

                var year = date.getUTCFullYear();
                var month = date.getUTCMonth() + 1;
                var day = date.getUTCDate();
                var hours = date.getUTCHours();
                var mins = date.getUTCMinutes();

                var end = "**" + day.toString() + "/" + month.toString() + "/" + year.toString() + "** at " + hours.toString() + ":";

                if (mins.toString().length == 1)
                    end += "0";

                end += mins.toString() + " (UTC)"

                //NameHere joined on 30/12/2017 at 16:56
                message.reply("you joined on " + end)
                    .catch(self.logger.error);
            })
            .catch(e => self.logger.error(e, 'joined'));
   }
}

exports['contest'] = {
    usage: "Logs the user's entry on a private channel.",
    process: function (message, args) {
        var chnl = message.guild.channels.find('name', contestChannelName); //searches for a channel named #member-log
        if (!chnl) return;  // if channel not found, abort
        var msgcontent = message.content.slice(config.prefix.length + 7);
        var member = message.member.user;

        chnl.send(member+"#"+member.discriminator+"\nUsed medium:\nLink: "+msgcontent);
    }
}

function memberAdd(member) {
    log(member, 'joined the server', 0x18bb68, true);

    if (member.user.bot)
        return;

    var embed = new Discord.RichEmbed()
        .setColor(parseInt(self.config.embedCol, 16))
        .setTitle('Welcome!')
        .setDescription(welcomeText)
        .setFooter(new Date());

    member.send({ embed: embed })
        .catch(self.logger.error);
}

function memberRemove(member) {
    log(member, 'left the server', 0xff8c00, false);
}

function log(member, message, colour, joined) {
    var channel = member.guild.channels.find('name', logChannelName);
    self.logger.log(member.user.username + ' ' + message, 'members');

    if (!channel) {
        self.logger.log('no #' + logChannelName + ' on this server');
        return;
    }

    var embed = new Discord.RichEmbed()
        .setColor(colour)
        .setDescription(`<@${member.user.id}> ${message}`)
        .setFooter(new Date());

    if (!joined)
        embed.setDescription(`**${member.user.username}#${member.user.discriminator}** ${message}`);


    channel.send({ embed: embed });

}
