import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const durationChoices = [
    { name: "5 minutes", value: 5 },
    { name: "10 minutes", value: 10 },
    { name: "30 minutes", value: 30 },
    { name: "1 heure", value: 60 },
    { name: "6 heures", value: 360 },
    { name: "1 jour", value: 1440 },
    { name: "1 semaine", value: 10080 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Rendre muet un utilisateur pour une durée spécifique.")
        .addUserOption((option) =>
            option
                .setName("utilisateur")
                .setDescription("Utilisateur à rendre muet")
                .setRequired(true),
        )
        .addIntegerOption(
            (option) =>
                option
                    .setName("durée")
                    .setDescription("Durée du mute")
                    .setRequired(true)
                    .addChoices(...durationChoices),
        )
        .addStringOption((option) =>
            option.setName("raison").setDescription("Raison du mute"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Mute interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'mute'
            });
            return;
        }

        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                throw new TitanBotError(
                    "Permissions insuffisantes",
                    ErrorTypes.PERMISSION,
                    "Vous devez avoir la permission `Modérer les membres` pour rendre quelqu'un muet."
                );
            }

            const targetUser = interaction.options.getUser("utilisateur");
            const member = interaction.options.getMember("utilisateur");
            const durationMinutes = interaction.options.getInteger("durée");
            const reason = interaction.options.getString("raison") || "Aucune raison fournie";

            if (targetUser.id === interaction.user.id) {
                throw new TitanBotError(
                    "Impossible de se rendre muet",
                    ErrorTypes.VALIDATION,
                    "Vous ne pouvez pas vous rendre muet vous-même."
                );
            }
            if (targetUser.id === client.user.id) {
                throw new TitanBotError(
                    "Impossible de rendre le bot muet",
                    ErrorTypes.VALIDATION,
                    "Vous ne pouvez pas rendre le bot muet."
                );
            }
            if (!member) {
                throw new TitanBotError(
                    "Utilisateur non trouvé",
                    ErrorTypes.USER_INPUT,
                    "L'utilisateur cible n'est pas actuellement sur ce serveur."
                );
            }

            if (!member.moderatable) {
                throw new TitanBotError(
                    "Impossible de rendre cet utilisateur muet",
                    ErrorTypes.PERMISSION,
                    "Je ne peux pas rendre cet utilisateur muet. Il pourrait avoir un rôle plus élevé que le mien ou le vôtre."
                );
            }

            const durationMs = durationMinutes * 60 * 1000;
            await member.timeout(durationMs, reason);

            const durationDisplay =
                durationChoices.find((c) => c.value === durationMinutes)
                    ?.name || `${durationMinutes} minutes`;

            const caseId = await logModerationAction({
                client,
                guild: interaction.guild,
                event: {
                    action: "Membre rendu muet",
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `${reason}\nDurée: ${durationDisplay}`,
                    duration: durationDisplay,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        durationMinutes,
                        muteEnds: new Date(Date.now() + durationMs).toISOString()
                    }
                }
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        `🔇 **Rendu muet** ${targetUser.tag} pour ${durationDisplay}.`,
                        `**Raison:** ${reason}\n**Cas ID:** #${caseId}`,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Mute command error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        error.userMessage || "Une erreur inattendue s'est produite lors de l'action mute. Veuillez vérifier mes permissions de rôle.",
                    ),
                ],
            });
        }
    }
};
