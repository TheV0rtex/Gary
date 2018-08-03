var Discord = require("discord.js"),
    request = require("request"),
    fs = require('fs'),
    quizConfig = require('./quizconfig.json');

var self = this;
self.client = null;
self.logger = null;

var prefix = null;
var quizChannelName = '';
var currentQuiz = null;
var correctAnswer = null;
var participantsAnsweredQuestion = 0;
var embedCol = null;

exports.commands = [
    "quiz"
]

exports.init = function (context) {
    self.client = context.client;
    self.logger = context.logger;

    var config = context.config;

    prefix = config.prefix;
    embedCol = parseInt(config.embedCol, 16);
}

// Commands
exports['quiz'] = {
    usage: 'Use `quiz help` for a list of subcommands',
    process: function (message, args) {
        //If no argument was provided, send help and return.
        if (args[0] == null) {
            sendHelp(message);
            return;
        }

        //Quiz commands
        switch (args[0].toLowerCase()) {
            case "start": {
                //You cannot start a quiz if one is already open.
                if (currentQuiz != null) {
                    message.reply("the quiz is already in progress.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //You just provide the 'numOfParticipants' argument.
                if (args[1] == null) {
                    message.reply("the correct usage  is `" + prefix + "quiz start <players> [questions] [difficulty].`")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                if (isNaN(parseInt(args[1]))) {
                    message.reply("that is not a valid integer")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                if (parseInt(args[1]) > parseInt(quizConfig.maxPlayers)) {
                    message.reply("the maximum amount of players is " + quizConfig.maxPlayers)
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                var players = args[1];
                var questions = parseInt(args[2]);
                var difficulty = args[3];

                if (isNaN(questions)) {
                    questions = 10;
                }

                if (questions < 1 || questions > 20) {
                    message.reply('the minimum amount of questions is 1, and the maximum is 20');
                    return;
                }

                if (difficulty == null) {
                    difficulty = 'medium';
                }

                if (difficulty.toLowerCase() != 'easy' && difficulty.toLowerCase() != 'medium' && difficulty.toLowerCase() != 'hard') {
                    message.reply('available difficulty types are `easy`, `medium` and `hard`');
                    return;
                }

                //Generates quiz and sends feedback to user.
                generateQuiz(args[1], questions, difficulty, message);
                message.channel.send(`**A ${args[1]} player quiz with ${questions} questions (${difficulty} difficulty) has been created**\nUse ${prefix}quiz join to join it.`);
                break;
            }
            case "join": {
                //You cannot join if a quiz has not been created yet.
                if (currentQuiz == null) {
                    message.reply("the quiz has not been created yet.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //You cannot join if the quiz has already started.
                if (currentQuiz.started) {
                    message.reply("the quiz has already started.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //You cannot join if you have already joined.
                var x = null;
                for (var i = 0; i < currentQuiz.participants.length; i++) {
                    if (currentQuiz.participants[i].id == message.author.id)
                        x = currentQuiz.participants[i];
                }
                if (x != null) {
                    message.reply("you have already joined this quiz.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //Create participant.
                var participant = {
                    id: message.author.id,
                    score: 0,
                    lastAnswer: "",
                    lastScoreModifider: 0,
                    answeredCurrentQuestion: false
                };

                //Add participant created to the database and send feedback.
                currentQuiz.participants.push(participant);
                message.reply("quiz successfully joined. Waiting for " + (currentQuiz.participantsToStart - currentQuiz.participants.length) + " more players to start the quiz.")
                    .then((msg) => { msg.delete(5000) })
                    .catch(self.logger.error);

                //Check if we have enough players to start the quiz.
                if (currentQuiz.participantsToStart == currentQuiz.participants.length)
                    beginQuiz(message);
                break;
            }
            case "answer": {
                //You cannot answer if a question has not been asked
                if (correctAnswer == null || currentQuiz == null) {
                    message.reply("a question has not been asked yet.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //You must provide a choice
                if (args[1] == null) {
                    message.reply("correct usage is `" + prefix + "quiz answer [letter]`")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                var choice = args[1].toLowerCase();

                //Get the participant
                var participant = null;

                for (var i = 0; i < currentQuiz.participants.length; i++) {
                    if (currentQuiz.participants[i].id == message.author.id)
                        participant = currentQuiz.participants[i];
                }

                //You cannot answer if you have not entered.
                if (participant == null) {
                    message.reply("you have not yet entered this quiz.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //You cannot answer if you have already answered.
                if (participant.answeredCurrentQuestion) {
                    message.reply("you have already answered this question.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //You cannot answer with a choice other than 'A', 'B', 'C' or 'D'
                if (choice != 'a' && choice != 'b' && choice != 'c' && choice != 'd') {
                    message.reply("please use `" + prefix + "quiz answer a`, `" + prefix + "quiz answer b`, `" + prefix + "quiz answer c` or `" + prefix + "quiz answer b`")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                //Generate scoremodiier between 'max' and 'min'.
                var max = -1;
                var min = -1000;
                var scoreModifier = Math.floor(Math.random() * (max - min + 1)) + min;

                //If we got it correct, change the scoremodifier to +1.
                if (choice == correctAnswer)
                    scoreModifier = 1;

                //Set participant variables
                participant.score += scoreModifier;
                participantsAnsweredQuestion += 1;
                participant.lastAnswer = choice.toUpperCase();
                participant.lastScoreModifier = scoreModifier;
                participant.answeredCurrentQuestion = true;

                if (participantsAnsweredQuestion == currentQuiz.participants.length)
                    revealAnswer(message);
                break;
            }
            case "help": {
                sendHelp(message);
                break;
            }
            case "leave": {
                if (currentQuiz == null) {
                    message.reply("the quiz has not been created yet.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                if (currentQuiz.started) {
                    message.reply("the quiz started so you cannot leave.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                var num = null;
                for (var i = 0; i < currentQuiz.participants.length; i++) {
                    if (currentQuiz.participants[i].id == message.author.id)
                        num = i;
                }

                if (num == null) {
                    message.reply("you have not joined the quiz.")
                        .then((msg) => { msg.delete(5000) })
                        .catch(self.logger.error);
                    return;
                }

                currentQuiz.participants = currentQuiz.participants.splice(num, 1);
                message.reply("quiz successfully left.")
                    .then((msg) => { msg.delete(5000) })
                    .catch(self.logger.error);
                break;
            }
        }
    }
};

function cancelQuiz(message) {

    if (currentQuiz == null || currentQuiz.started)
        return;

    message.channel.send("The quiz has expired. Start a new one with `" + prefix + "quiz start`.");

    //reset all the quiz variables.
    currentQuiz = null;
    correctAnswer = null;
    participantsAnsweredQuestion = 0;
}

function sendHelp(message) {
    var result = "";

    result += "`quiz start <players> [questions] [difficulty]` | starts a quiz\n";
    result += "`quiz join` | joins a quiz\n";
    result += "`quiz answer <A/B/C/D>` | answers a question\n";
    result += "`quiz leave` | leave the quiz\n";
    result += "`quiz help` | get quiz commands\n";

    message.author.send(result)
}

function beginQuiz(message) {
    //Make sure no-one else can join
    currentQuiz.started = true;

    //Send feedback to the user
    message.channel.send("**THE QUIZ IS STARTING**");

    //Ask the first question
    askQuestion(message);
}

function askQuestion(message) {

    //Get the current question
    var question = currentQuiz.questions[currentQuiz.currentQuestion];

    //Create the richembed and set the title
    var embed = new Discord.RichEmbed()
        .setColor(embedCol)
        .setTitle("**Question #" + (currentQuiz.currentQuestion + 1) + "**");

    var q = question.question;

    q = q.replace(/&quot;/g, '"');
    q = q.replace(/&#039;/g, "'");

    //Make the text variable
    var text = q + "\n\n";

    //Create array of answers and shuffle
    var answers = [question.correct_answer, question.incorrect_answers[0], question.incorrect_answers[1], question.incorrect_answers[2]];
    for (var i = 0; i < answers.length; i++) {
        var a = answers[i];
        a = a.replace(/&quot;/g, '"');
        a = a.replace(/&#039;/g, "'");
        answers[i] = a;
    }
    shuffle(answers);


    //Add answers to 'text'
    text += "**A** " + answers[0] + "\n";
    text += "**B** " + answers[1] + "\n";
    text += "**C** " + answers[2] + "\n";
    text += "**D** " + answers[3] + "\n";
    text += "\nAnswer with `" + prefix + "quiz answer [letter]`. You have " + (quizConfig.timeToAnswer) + " seconds to answer";


    //Find out which letter is the correct answer (we forgot in the shuffling)
    var correct_Answer = "";

    for (var i = 0; i < answers.length; i++) {
        if (answers[i] == question.correct_answer) {
            if (i == 0)
                correct_Answer = "a";
            if (i == 1)
                correct_Answer = "b";
            if (i == 2)
                correct_Answer = "c";
            if (i == 3)
                correct_Answer = "d";
        }
    }

    //Set the description
    embed.setDescription(text);

    //Send the embed
    message.channel.send({ embed });

    //Set the correct answer and increment the current question counter
    correctAnswer = correct_Answer;
    currentQuiz.currentQuestion++;

    // setTimeout takes a value in milliseconds
    ((s) => new Promise((r, _) => setTimeout(r, s * 1000)))(quizConfig.timeToAnswer)
        .then(() => {
            if (currentQuiz == null)
                return;

            for (var i = 0; i < currentQuiz.participants.length; i++) {
                if (currentQuiz.participants[i].answeredCurrentQuestion == false) {
                    //Generate scoremodiier between 'max' and 'min'.
                    var max = -1;
                    var min = -1000;
                    var scoreModifier = Math.floor(Math.random() * (max - min + 1)) + min;

                    //Set participant variables
                    currentQuiz.participants[i].score += scoreModifier;
                    currentQuiz.participants[i].lastScoreModifier = scoreModifier;
                    currentQuiz.participants[i].answeredCurrentQuestion = false;
                }
            }
            revealAnswer(message);
        }).catch(self.logger.error);
}

function revealAnswer(message) {

    //Create embed and set the title and description.
    var embed = new Discord.RichEmbed()
        .setTitle("**Question Over**")
        .setColor(embedCol)
        .setDescription("The correct answer was `" + correctAnswer.toUpperCase() + "`");

    //Set the answer counter to 0.
    participantsAnsweredQuestion = 0;

    //Leaderboard text variable.
    var text = "";

    var sorted = currentQuiz.participants;
    sorted.sort(function (a, b) { return a.score - b.score });

    //Populate leaderboard.
    for (var i = 0; i < sorted.length; i++) {
        var user = self.client.users.get(sorted[i].id);
        if (sorted[i].answeredCurrentQuestion) {
            text += "#" + (i + 1) + " - " + user.username + " answered " + sorted[i].lastAnswer + " and has a total score of ";
            if (sorted[i].score > 0)
                text += "+";
            text += sorted[i].score + " points\n";
        }
        else {
            text += "#" + (i + 1) + " - " + user.username + " did not answer and has a total score of ";
            if (sorted[i].score > 0)
                text += "+";
            text += sorted[i].score + " points\n";
        }
    }

    //Add the leaderboard field to the embed.
    embed.addField("**Leaderboard**", text);

    //Send the embed
    message.channel.send({embed});

    //Reset 'participant.answeredQuestion' value
    for (var i = 0; i < currentQuiz.participants.length; i++) {
        currentQuiz.participants[i].answeredCurrentQuestion = false;
    }

    //If we still have a question to go, ask another one.
    if (currentQuiz.currentQuestion < currentQuiz.totalQuestions) {
        askQuestion(message);
        return;
    }

    //If we dont, then reset all the quiz variables.
    currentQuiz = null;
    correctAnswer = null;
    participantsAnsweredQuestion = 0;
}

function generateQuiz(participantsToStart, numOfQuestions, difficulty, message) {

    var url = "https://opentdb.com/api.php?amount=" + numOfQuestions + "&category=15&difficulty=" + difficulty + "&type=multiple";
    var questions = null;

    //Get questions
    request({
        url: url,
        json: false
    },
    function (error, response, body) {

        questions = JSON.parse(body).results;

        var quiz = {
            started: false,
            participants: [],
            participantsToStart: participantsToStart,
            totalQuestions: numOfQuestions,
            currentQuestion: 0,
            questions: questions
        };

        currentQuiz = quiz;
        // setTimeout takes a value in milliseconds
        setTimeout(cancelQuiz, parseInt(quizConfig.timeToJoin) * 1000, message);
    });
}

function shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}
