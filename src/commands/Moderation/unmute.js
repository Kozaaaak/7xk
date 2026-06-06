import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderationService.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Retirer le mute d'un utilisateur")
        .addUserOption((option) =>
            option
                .setName("utilisateur")
                .setDescription("Utilisateur à démute")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Unmute interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unmute'
            });
            return;
        }

        try {
                const targetUser = interaction.options.getUser("utilisateur");
                const member = interaction.options.getMember("utilisateur");

                
                const result = await ModerationService.removeTimeoutUser({
                    guild: interaction.guild,
                    member,
                    moderator: interaction.member
                });

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            `🔓 **Mute retiré** à ${targetUser.tag}`,
                        ),
                    ],
                });
        } catch (error) {
            logger.error('Unmute command error:', error);
            await handleInteractionError(interaction, error, { subtype: 'unmute_failed' });
        }
    }
};
