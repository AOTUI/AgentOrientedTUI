import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import AdmZip from 'adm-zip';

function toSafeRelativePath(raw: string): string | null {
    const normalized = raw.replace(/\\/g, '/').trim();
    if (!normalized || normalized.endsWith('/')) {
        return null;
    }
    const cleaned = path.posix.normalize(normalized).replace(/^\/+/, '');
    if (!cleaned || cleaned.startsWith('..')) {
        return null;
    }
    return cleaned;
}

export async function importSkillZipToDirectory(zipFilePath: string, targetDirectory: string): Promise<{ writtenFiles: number }> {
    const zip = new AdmZip(zipFilePath);
    const entries = zip.getEntries();

    const safeFileEntries = entries
        .filter((entry) => !entry.isDirectory)
        .map((entry) => ({
            entry,
            relativePath: toSafeRelativePath(entry.entryName),
        }))
        .filter((item): item is { entry: AdmZip.IZipEntry; relativePath: string } => Boolean(item.relativePath));

    const skillManifestCount = safeFileEntries.filter((item) => path.posix.basename(item.relativePath) === 'SKILL.md').length;
    if (skillManifestCount === 0) {
        throw new Error('Invalid skill package: zip must contain at least one SKILL.md file.');
    }

    await mkdir(targetDirectory, { recursive: true });

    let writtenFiles = 0;

    for (const { entry, relativePath } of safeFileEntries) {
        const destination = path.resolve(targetDirectory, relativePath);
        if (!destination.startsWith(path.resolve(targetDirectory))) {
            continue;
        }

        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, entry.getData());
        writtenFiles += 1;
    }

    return { writtenFiles };
}
