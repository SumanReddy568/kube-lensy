
export interface DescribeSection {
    title: string;
    isTable: boolean;
    content: string | Record<string, string>[];
}

export function parseK8sDescribe(text: string): DescribeSection[] {
    if (!text) return [];

    const sections: DescribeSection[] = [];
    const lines = text.split('\n');

    const basicProps: Record<string, string>[] = [];

    // Major sections that usually have nested objects or lists
    const complexSections = ['Containers', 'Conditions', 'Volumes', 'Events', 'Labels', 'Annotations', 'Tolerations', 'Node-Selectors', 'Controlled By', 'Status', 'IPs', 'QoS Class', 'Strategy', 'Replicas', 'Selector', 'Template', 'Pod Template', 'Spec', 'Status', 'Endpoints'];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line || !line.trim()) {
            i++;
            continue;
        }

        // Match "Key: Value" or "Key:" at the START of a line (no leading spaces)
        const match = line.match(/^([A-Za-z\s-]+):\s*(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();

            if (complexSections.includes(key) || !value) {
                // This is a major section
                const sectionLines: string[] = [];
                if (value) sectionLines.push(value);

                i++;
                while (i < lines.length) {
                    const nextLine = lines[i];
                    // If next line starts at the very beginning with a key (no spaces), it's a new top-level section
                    if (nextLine.trim() && !nextLine.startsWith(' ') && nextLine.includes(':')) {
                        break;
                    }
                    sectionLines.push(nextLine);
                    i++;
                }

                sections.push({
                    title: key,
                    isTable: false,
                    content: sectionLines.join('\n').trim()
                });
                continue;
            } else {
                // Top-level simple property
                basicProps.push({ key, value });
            }
        } else if (!line.startsWith(' ')) {
            // Maybe a section header without a colon?
            const headerMatch = line.match(/^([A-Z][A-Za-z\s]+)$/);
            if (headerMatch) {
                const title = headerMatch[1].trim();
                const sectionLines: string[] = [];
                i++;
                while (i < lines.length) {
                    const nextLine = lines[i];
                    if (nextLine.trim() && !nextLine.startsWith(' ')) break;
                    sectionLines.push(nextLine);
                    i++;
                }
                sections.push({
                    title,
                    isTable: false,
                    content: sectionLines.join('\n').trim()
                });
                continue;
            }
        }
        i++;
    }

    if (basicProps.length > 0) {
        sections.unshift({
            title: 'Common Metadata',
            isTable: true,
            content: basicProps
        });
    }

    return sections;
}
