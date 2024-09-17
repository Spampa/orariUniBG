import axios from "axios";

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getOrari = async (day, username, week = false) => {
    const user = await prisma.user.findUnique({
        where: {
            username
        },
        select: {
            courseId: true,
            annoId: true,
            course: {
                select: {
                    school: true
                }
            }
        }
    });
    
    if(!user) return undefined;

    const formData = new FormData();
    let date = day.split('/');
    
    date[1].length === 1 ? date[1] = '0' + date[1] : date[1];
    date = `${date[0]}-${date[1]}-${date[2]}`;

    //init form data
    formData.append('view', 'easycourse');
    formData.append('form-type', 'corso');
    formData.append('include', 'corso');
    formData.append('anno', '2024');
    formData.append('scuola', user.course.school.schoolId);
    formData.append('corso', user.courseId);
    formData.append('date', date);
    formData.append('_lang', 'it');
    formData.append('txtcurr', '1 - PERCORSO COMUNE');
    formData.append('anno2[]', user.annoId); //2014
    formData.append('visualizzazione_orario', 'cal');

    const orario = [];
    const data = (await axios.post('https://logistica.unibg.it/PortaleStudenti/grid_call.php', formData)).data;

    for (const subject of data.celle) {
        if((week || subject.data === date) && subject.Annullato === '0'){
            orario.push({
                subject: subject.nome_insegnamento,
                date: subject.data,
                schedule: subject.orario,
                classroom: subject.aula,
                data: subject.data,
            });
        }
    }

    return orario;
}