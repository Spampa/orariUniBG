import { PrismaClient } from '@prisma/client';
import { fetchSchedule } from '../services/fetchSchedule.js';
import { formatDate } from '../../controller/lib/utils/formatDate.js';

const prisma = new PrismaClient();

export async function updateSchedules() {
    try {
        const updates = [];

        let courses = [];

        if (process.env.NODE_ENV === 'production') {
            courses = await prisma.course.findMany({
                select: {
                    courseId: true,
                    annoId: true,
                    department: {
                        select: {
                            schoolId: true
                        }
                    }
                }
            });
        }
        else {
            const userCourses = await prisma.user.findMany({
                distinct: ['annoId', 'courseId'],
                select: {
                    courseId: true,
                    annoId: true,
                }
            });

            for (const u of userCourses) {
                courses.push(
                    await prisma.course.findUnique({
                        where: {
                            courseId_annoId: {
                                courseId: u.courseId,
                                annoId: u.annoId
                            }
                        },
                        select: {
                            courseId: true,
                            annoId: true,
                            department: {
                                select: {
                                    schoolId: true
                                }
                            }
                        }
                    })
                )
            }
        }

        const minWeek = (await prisma.schedule.aggregate({
            _min: {
                week: true
            }
        }))._min.week;

        for (let i = parseInt(minWeek || 0); i < parseInt(minWeek || 0) + parseInt(process.env.MAX_WEEKS); i++) {
            for (const c of courses) {
                const schedule = await fetchSchedule(formatDate(7 * (i - parseInt(minWeek || 0))), c.courseId, c.annoId, c.department.schoolId);
                for (const s of schedule) {
                    if (!s.subject) continue;
                    const oldSchedule = await prisma.schedule.findUnique({
                        where: {
                            subject_courseId_courseAnnoId_date_start_end_classroom: {
                                courseId: s.courseId,
                                courseAnnoId: s.courseAnnoId,
                                subject: s.subject,
                                date: s.date,
                                start: s.start,
                                end: s.end,
                                classroom: s.classroom
                            }
                        }
                    });

                    const newSchedule = await prisma.schedule.upsert({
                        where: {
                            subject_courseId_courseAnnoId_date_start_end_classroom: {
                                courseId: s.courseId,
                                courseAnnoId: s.courseAnnoId,
                                subject: s.subject,
                                date: s.date,
                                start: s.start,
                                end: s.end,
                                classroom: s.classroom
                            }
                        },
                        update: {
                            classroom: s.classroom,
                            teacher: s.teacher,
                            isCanceled: s.isCanceled
                        },
                        create: {
                            courseId: s.courseId,
                            courseAnnoId: s.courseAnnoId,
                            subject: s.subject,
                            date: s.date,
                            start: s.start,
                            startMinutes: s.startMinutes,
                            end: s.end,
                            endMinutes: s.endMinutes,
                            classroom: s.classroom,
                            teacher: s.teacher,
                            isCanceled: s.isCanceled,
                            week: i
                        }
                    });

                    if (JSON.stringify(oldSchedule) !== JSON.stringify(newSchedule)) {
                        if (oldSchedule) updates.push(newSchedule);
                    }
                }
            };
        }
        return updates;
    }
    catch (err) {
        console.log("Errore nell'aggiornamento dati", err);
    }
}