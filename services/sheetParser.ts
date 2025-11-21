import { TestReport, QuestionLog, SubjectData, QuestionType, QuestionStatus, ErrorReason, TestType, TestSubType } from '../types';

const parseCSV = (csv: string): { headers: string[], rows: string[][] } => {
    const lines = csv.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const cleanCell = (cell: string) => cell.trim().replace(/^"|"$/g, '');

    const headers = lines[0].split(',').map(cleanCell);
    const rows = lines.slice(1).map(line => line.split(',').map(cleanCell));

    return { headers, rows };
}

const getHeaderIndex = (headers: string[], keys: string[], required: boolean = true): number => {
    for (const key of keys) {
        const lowerKey = key.toLowerCase();
        const index = headers.findIndex(h => h.toLowerCase().trim() === lowerKey);
        if (index !== -1) return index;
    }
    
    if (required) {
        throw new Error(`Required column (one of: ${keys.join(', ')}) not found in CSV header. Please check your sheet.`);
    }
    return -1;
};


export const parseReportsFromCsv = (csv: string): TestReport[] => {
    const { headers, rows } = parseCSV(csv);
    const reportsMap = new Map<string, TestReport>();

    // These columns define the structure of the *import* format
    const dateIdx = getHeaderIndex(headers, ['testdate', 'date']);
    const testNameIdx = getHeaderIndex(headers, ['testname', 'test name']);
    const subjectIdx = getHeaderIndex(headers, ['subject']);
    const marksIdx = getHeaderIndex(headers, ['marks']);
    const rankIdx = getHeaderIndex(headers, ['rank']);
    const correctIdx = getHeaderIndex(headers, ['correct']);
    const wrongIdx = getHeaderIndex(headers, ['wrong']);
    const unansweredIdx = getHeaderIndex(headers, ['unanswered']);
    const partialIdx = getHeaderIndex(headers, ['partial']);
    const typeIdx = getHeaderIndex(headers, ['type'], false);
    const subTypeIdx = getHeaderIndex(headers, ['subtype', 'sub type'], false);

    let currentTestName = '';
    let currentTestDate = '';
    let currentTestType: TestType | undefined;
    let currentTestSubType: TestSubType | undefined;

    for (const row of rows) {
        const dateValue = row[dateIdx];
        if (dateValue) {
            // Try to parse MM/DD/YYYY or similar formats
            const parts = dateValue.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
            if (parts) {
                 // Assuming M/D/YYYY format, convert to YYYY-MM-DD
                 currentTestDate = `${parts[3]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (!isNaN(new Date(dateValue).getTime())) {
                // If it's a parsable date string (like YYYY-MM-DD), use it directly
                currentTestDate = new Date(dateValue).toISOString().split('T')[0];
            }
        }
        
        const testName = row[testNameIdx];
        if (testName) currentTestName = testName;

        const type = typeIdx !== -1 ? row[typeIdx] : undefined;
        if (type && Object.values(TestType).includes(type as TestType)) currentTestType = type as TestType;

        const subType = subTypeIdx !== -1 ? row[subTypeIdx] : undefined;
        if (subType && Object.values(TestSubType).includes(subType as TestSubType)) currentTestSubType = subType as TestSubType;
        
        const subject = row[subjectIdx]?.toLowerCase().trim();
        const validSubjects: Array<'physics' | 'chemistry' | 'maths' | 'total'> = ['physics', 'chemistry', 'maths', 'total'];

        if (!currentTestName || !subject || !validSubjects.includes(subject as any)) {
            continue;
        }

        const reportKey = `${currentTestDate}-${currentTestName}`;
        if (!reportsMap.has(reportKey)) {
            reportsMap.set(reportKey, {
                id: `gsheet-${Date.now()}-${reportsMap.size}`,
                testName: currentTestName,
                testDate: currentTestDate,
                type: currentTestType,
                subType: currentTestSubType,
                physics: {} as SubjectData,
                chemistry: {} as SubjectData,
                maths: {} as SubjectData,
                total: {} as SubjectData,
            });
        }
        
        const report = reportsMap.get(reportKey)!;

        const subjectData: SubjectData = {
            marks: parseInt(row[marksIdx]) || 0,
            rank: parseInt(row[rankIdx]) || 0,
            correct: parseInt(row[correctIdx]) || 0,
            wrong: parseInt(row[wrongIdx]) || 0,
            unanswered: parseInt(row[unansweredIdx]) || 0,
            partial: parseInt(row[partialIdx]) || 0,
        };
        
        report[subject as 'physics' | 'chemistry' | 'maths' | 'total'] = subjectData;
    }

    return Array.from(reportsMap.values());
};

export const parseLogsFromCsv = (csv: string, existingReports: TestReport[]): QuestionLog[] => {
    const { headers, rows } = parseCSV(csv);
    const logs: QuestionLog[] = [];
    const reportNameIdMap = new Map(existingReports.map(r => [r.testName.toLowerCase().trim(), r.id]));
    
    const colIndices = {
        testName: getHeaderIndex(headers, ['testname', 'test name']),
        subject: getHeaderIndex(headers, ['subject']),
        questionNumber: getHeaderIndex(headers, ['questionnumber', 'q.no', 'q. no.']),
        status: getHeaderIndex(headers, ['status']),
        questionType: getHeaderIndex(headers, ['questiontype', 'question type']),
        topic: getHeaderIndex(headers, ['topic', 'chapter', 'concept']),
        marksAwarded: getHeaderIndex(headers, ['marksawarded', 'marks awarded']),
        reasonForError: getHeaderIndex(headers, ['reasonforerror', 'reason for error'], false),
    };

    let currentTestName = '';
    rows.forEach(row => {
        const testNameVal = row[colIndices.testName]?.trim();
        if (testNameVal) {
            currentTestName = testNameVal;
        }

        const testId = reportNameIdMap.get(currentTestName.toLowerCase().trim());

        if (!testId) {
            return;
        }

        const questionNumber = parseInt(row[colIndices.questionNumber], 10);
        if (isNaN(questionNumber) || questionNumber <= 0) {
            return;
        }

        const log: QuestionLog = {
            testId,
            subject: row[colIndices.subject].toLowerCase() as 'physics' | 'chemistry' | 'maths',
            questionNumber: questionNumber,
            status: row[colIndices.status] as QuestionStatus,
            questionType: row[colIndices.questionType] as QuestionType,
            topic: row[colIndices.topic],
            marksAwarded: parseFloat(row[colIndices.marksAwarded]),
            reasonForError: colIndices.reasonForError !== -1 ? (row[colIndices.reasonForError] as ErrorReason) || undefined : undefined,
        };
        logs.push(log);
    });

    return logs;
};


// --- EXPORT FUNCTIONS ---

const createCsvContent = (headers: string[], rows: (string|number|undefined)[][]): string => {
    const headerRow = headers.join(',');
    const dataRows = rows.map(row => 
        row.map(cell => {
            const strCell = String(cell ?? '');
            if (strCell.includes(',')) {
                return `"${strCell.replace(/"/g, '""')}"`;
            }
            return strCell;
        }).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
};

const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

export const exportReportsToCsv = (reports: TestReport[]) => {
    const subjectProps: (keyof SubjectData)[] = ['marks', 'rank', 'correct', 'wrong', 'unanswered', 'partial'];
    const subjects: ('physics' | 'chemistry' | 'maths' | 'total')[] = ['physics', 'chemistry', 'maths', 'total'];
    
    const headers = ['testDate', 'testName', 'type', 'subType'];
    subjects.forEach(subject => {
        subjectProps.forEach(prop => {
            headers.push(`${subject}.${prop}`);
        });
    });

    const rows = reports.map(report => {
        const row: (string|number|undefined)[] = [report.testDate, report.testName, report.type, report.subType];
        subjects.forEach(subjectKey => {
            subjectProps.forEach(propKey => {
                row.push(report[subjectKey][propKey]);
            });
        });
        return row;
    });

    const csvContent = createCsvContent(headers, rows);
    triggerDownload('jee_reports_export.csv', csvContent);
};

export const exportLogsToCsv = (logs: QuestionLog[], reports: TestReport[]) => {
    const reportNameMap = new Map(reports.map(r => [r.id, r.testName]));
    
    const headers: (keyof QuestionLog | 'testName')[] = [
        'testName', 'subject', 'questionNumber', 'status', 'questionType', 'topic', 'marksAwarded', 'reasonForError'
    ];

    const rows = logs.map(log => {
        return [
            reportNameMap.get(log.testId) || 'Unknown Test',
            log.subject,
            log.questionNumber,
            log.status,
            log.questionType,
            log.topic,
            log.marksAwarded,
            log.reasonForError
        ];
    });

    const csvContent = createCsvContent(headers as string[], rows);
    triggerDownload('jee_question_logs_export.csv', csvContent);
};

export const exportSingleReportToCsv = (report: TestReport) => {
    const subjects: ('maths' | 'physics' | 'chemistry' | 'total')[] = ['maths', 'physics', 'chemistry', 'total'];
    const rows: (string | number | undefined)[][] = [];

    let formattedDate = '';
    if (report.testDate) {
        const parts = report.testDate.split('-');
        if (parts.length === 3) {
            formattedDate = `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY
        } else {
            formattedDate = report.testDate; // Fallback
        }
    }
    
    subjects.forEach((subjectKey, index) => {
        const subjectData = report[subjectKey as 'physics' | 'chemistry' | 'maths' | 'total'];
        if (!subjectData || typeof subjectData.correct === 'undefined') return;

        const totalQuestions = subjectData.correct + subjectData.wrong + subjectData.unanswered + subjectData.partial;

        const row = [
            index === 0 ? formattedDate : '',
            report.testName,
            subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1),
            subjectData.marks,
            subjectData.rank,
            subjectData.correct,
            subjectData.wrong,
            subjectData.unanswered,
            subjectData.partial,
            totalQuestions,
            report.type,
            report.subType
        ];
        rows.push(row);
    });
    
    const csvContent = rows.map(row => 
        row.map(cell => {
            const strCell = String(cell ?? '');
            return strCell.includes(',') ? `"${strCell.replace(/"/g, '""')}"` : strCell;
        }).join(',')
    ).join('\n');

    const filename = `${report.testName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.csv`;
    triggerDownload(filename, csvContent);
};

export const exportExtractedQuestionsToCsv = (report: Partial<TestReport>, questions: Partial<QuestionLog>[]) => {
    const headers = ['Date', 'Test Name', 'Subject', 'Q. No.', 'Question Type', 'Status'];

    const sortedQuestions = [...questions].sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));

    const rows = sortedQuestions.map(q => {
        let formattedDate = '';
        if (report.testDate) { // Expects YYYY-MM-DD
            try {
                // Add T00:00:00 to avoid timezone issues that could shift the date
                formattedDate = new Date(`${report.testDate}T00:00:00`).toLocaleDateString('en-US'); // Format as MM/DD/YYYY
            } catch (e) {
                formattedDate = report.testDate; // Fallback
            }
        }
        
        return [
            formattedDate,
            report.testName || 'N/A',
            (q.subject || 'N/A').charAt(0).toUpperCase() + (q.subject || 'N/A').slice(1),
            q.questionNumber || 'N/A',
            q.questionType || 'N/A',
            q.status || 'N/A'
        ];
    });

    const csvContent = createCsvContent(headers, rows);
    const filename = `${(report.testName || 'questions').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_details.csv`;
    triggerDownload(filename, csvContent);
};


// --- New functions for Pushing to Sheet ---

const exportReportsForSheetImport = (reports: TestReport[]): string => {
    const headers = ['testDate', 'testName', 'subject', 'marks', 'rank', 'correct', 'wrong', 'unanswered', 'partial', 'type', 'subType'];
    const rows: (string | number | undefined)[][] = [];
    const subjects: ('physics' | 'chemistry' | 'maths' | 'total')[] = ['physics', 'chemistry', 'maths', 'total'];

    reports.forEach(report => {
        subjects.forEach((subjectKey, index) => {
            const subjectData = report[subjectKey];
            const row = [
                index === 0 ? report.testDate : '',
                index === 0 ? report.testName : '',
                subjectKey,
                subjectData.marks,
                subjectData.rank,
                subjectData.correct,
                subjectData.wrong,
                subjectData.unanswered,
                subjectData.partial,
                index === 0 ? report.type : '',
                index === 0 ? report.subType : '',
            ];
            rows.push(row);
        });
    });

    return createCsvContent(headers, rows);
};

const exportLogsForSheetImport = (logs: QuestionLog[], reports: TestReport[]): string => {
    const headers = ['testName', 'subject', 'questionNumber', 'status', 'questionType', 'topic', 'marksAwarded', 'reasonForError'];
    const reportNameMap = new Map(reports.map(r => [r.id, r.testName]));
    
    const rows = logs.map(log => [
        reportNameMap.get(log.testId) || 'Unknown Test',
        log.subject,
        log.questionNumber,
        log.status,
        log.questionType,
        log.topic,
        log.marksAwarded,
        log.reasonForError,
    ]);

    return createCsvContent(headers, rows);
};

export const downloadReportsForSheet = (reports: TestReport[]) => {
    const csvContent = exportReportsForSheetImport(reports);
    triggerDownload('reports_for_google_sheets.csv', csvContent);
};

export const downloadLogsForSheet = (logs: QuestionLog[], reports: TestReport[]) => {
    const csvContent = exportLogsForSheetImport(logs, reports);
    triggerDownload('logs_for_google_sheets.csv', csvContent);
};