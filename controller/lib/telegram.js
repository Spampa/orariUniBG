import axios from "axios";
import { handleCommand } from "./command.js";
import { handleCallback } from "./callback.js";

import { PrismaClient } from '@prisma/client';
import { logger } from "../../utils/logger.js";

const prisma = new PrismaClient();

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;

export async function sendMessage(chatId, text, buttons = []) {
    return await axios.post(`${BASE_URL}/sendMessage?parse_mode=html`, {
        chat_id: chatId,
        text: text,
        reply_markup: {
            inline_keyboard: buttons, // Pulsanti in colonna
            one_time_keyboard: true,  // La tastiera scompare dopo l'uso
            resize_keyboard: true
        }
    }).catch(async err => {
        if(err.status === 403){
            await prisma.user.upsert({
                where: {
                    chat: chatId
                },
                update: {
                    isBanned: true,
                    courseId: null,
                    annoId: null
                },
                create: {
                    chat: chatId,
                    isBanned: true,
                    time: new Date().toISOString()
                }
            });
            logger.info(`User with chat id ${chatId} is banned`);
        }
        else{
            logger.warn('Error to send message: ', err);
        }
    })
}

async function deleteMessage(chatId, messageId) {
    return await axios.post(`${BASE_URL}/deleteMessage`, {
        chat_id: chatId,
        message_id: messageId
    })
    .catch(err => {
        logger.warn('Deleting message error: ', err);
    });
}

export async function handleMessage(messageObj, user) {
    const messageText = messageObj.text;
    if(!messageText){
        logger.warn('No message found ', messageObj);
    }

    if(user){
        await prisma.user.update({
            where: {
                chat: user.chat
            },
            data: {
                lastMessage: messageText,
                time: new Date().toISOString()
            }
        })
    }

    try{
        const chatId = messageObj.chat.id;
        if(messageText.charAt(0) === "/"){
            const command = messageText.substring(1);
            const commandResponse = await handleCommand(command, messageObj, user);
            sendMessage(chatId, commandResponse.text, commandResponse.buttons);
        }
        else{
            sendMessage(chatId, 'Hello My Man😊');
        }
    }
    catch(err){
        logger.warn('Error', err);
    }
}

export async function handleCallbackMessage(callbackObj) {

    try{
        const data = callbackObj.data;
        if(data){
            const message = callbackObj.message;
            const chatId = callbackObj.from.id;
            deleteMessage(chatId, message.message_id);
            const handleResponse = await handleCallback(data, callbackObj);
            sendMessage(chatId, handleResponse.text, handleResponse.buttons);
        }
    }
    catch(err){
        logger.warn('Error', err);
    };
}

