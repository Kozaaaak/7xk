import { logger } from '../utils/logger.js';
import botConfig from '../config/bot.js';

export default {
  name: 'messageCreate',
  async execute(message, client) {
    // Log all messages to debug
    logger.debug(`Message received from ${message.author.tag}: "${message.content}"`);

    // Ignore bot messages
    if (message.author.bot) return;

    // Get the prefix from config
    const prefix = botConfig.commands.prefix;
    logger.debug(`Checking prefix: "${prefix}" in message: "${message.content}"`);

    // Check if message starts with prefix
    if (!message.content.startsWith(prefix)) return;

    // Extract command and arguments
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!commandName) return;

    logger.info(`Text command triggered: ${commandName}`);

    // Get the command from the collection
    const command = client.commands.get(commandName);

    if (!command) {
      // Silently ignore unknown commands
      logger.debug(`Command not found: ${commandName}`);
      return;
    }

    try {
      // Check if command has text mode support (optional)
      if (command.textOnly === false) {
        // Command doesn't support text mode
        return message.reply({
          content: `This command only supports slash commands (/${commandName}).`,
          ephemeral: true
        }).catch(err => logger.error('Failed to send error message:', err));
      }

      // Log command execution
      logger.info(`Text command executed: ${commandName} by ${message.author.tag} in ${message.guild?.name || 'DM'}`);

      // Create a mock interaction-like object for consistency with slash commands
      const textCommandContext = {
        user: message.author,
        guild: message.guild,
        channel: message.channel,
        member: message.member,
        client: client,
        reply: (options) => message.reply(options),
        deferReply: async () => { /* No-op for text commands */ },
        editReply: (options) => message.edit(options),
        followUp: (options) => message.reply(options),
        isCommand: () => true,
        isTextCommand: () => true,
      };

      // Execute the command
      if (typeof command.executeText === 'function') {
        // Command has dedicated text handler
        await command.executeText(textCommandContext, args);
      } else if (typeof command.execute === 'function') {
        // Fallback to regular execute method
        // Convert args to options format for compatibility
        const options = {
          getSubcommand: () => null,
          getSubcommandGroup: () => null,
          getString: (name) => args[0],
          getInteger: (name) => parseInt(args[0]),
          getUser: (name) => message.mentions.users.first(),
          getRole: (name) => message.mentions.roles.first(),
          getChannel: (name) => message.mentions.channels.first(),
        };

        await command.execute(textCommandContext, options);
      }

    } catch (error) {
      logger.error(`Error executing text command ${commandName}:`, error);
      
      const errorMessage = {
        content: `An error occurred while executing the command: ${error.message}`,
        ephemeral: true
      };

      try {
        await message.reply(errorMessage);
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
