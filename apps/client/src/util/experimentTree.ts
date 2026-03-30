/**
 * Builds a hierarchical folder tree from a flat list of experiment file paths.
 *
 * Rules:
 * - Only create a folder when it contains more than one experiment (directly or in sub-dirs).
 * - Collapse intermediate directories that have no direct experiments and only one child
 *   directory into a single folder label (e.g. "stuff/etc/etc2").
 * - Experiments in a directory with only one file are promoted to the parent level.
 */

export type TreeNode = FolderNode | ExperimentNode;

export interface FolderNode {
  type: 'folder';
  label: string;
  children: TreeNode[];
}

export interface ExperimentNode {
  type: 'experiment';
  /** Display label (filename without .json) */
  label: string;
  /** Full path as it appears in aa_index.json, used to set currentExperimentFilename */
  path: string;
}

// Internal raw tree used during construction
interface RawDir {
  experiments: { filename: string; path: string }[];
  subdirs: Map<string, RawDir>;
}

function newRawDir(): RawDir {
  return { experiments: [], subdirs: new Map() };
}

/**
 * Count total experiments reachable from this raw directory (recursively).
 */
function countExperiments(dir: RawDir): number {
  let count = dir.experiments.length;
  for (const sub of dir.subdirs.values()) {
    count += countExperiments(sub);
  }
  return count;
}

/**
 * Convert a RawDir into TreeNode[], applying collapsing and pruning rules.
 */
function convertDir(dir: RawDir): TreeNode[] {
  const result: TreeNode[] = [];

  // Process sub-directories
  for (const [name, subdir] of dir.subdirs.entries()) {
    const totalInSubdir = countExperiments(subdir);

    if (totalInSubdir <= 1) {
      // Don't create a folder — promote experiments to this level
      flattenExperiments(subdir, result);
    } else {
      // Collapse intermediate directories:
      // If this subdir has no direct experiments and exactly one child subdir,
      // merge them into a single label.
      let collapsedLabel = name;
      let current = subdir;
      while (
        current.experiments.length === 0 &&
        current.subdirs.size === 1
      ) {
        const [childName, childDir] = current.subdirs.entries().next()
          .value as [string, RawDir];
        collapsedLabel += '/' + childName;
        current = childDir;
      }

      result.push({
        type: 'folder',
        label: collapsedLabel,
        children: convertDir(current),
      });
    }
  }

  // Add direct experiments
  for (const exp of dir.experiments) {
    result.push({
      type: 'experiment',
      label: exp.filename.replace(/\.json$/i, ''),
      path: exp.path,
    });
  }

  // Sort: folders first (alphabetically), then experiments (alphabetically)
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return result;
}

/**
 * Recursively collect all experiments from a dir tree and push them flat into `out`.
 */
function flattenExperiments(dir: RawDir, out: TreeNode[]): void {
  for (const exp of dir.experiments) {
    out.push({
      type: 'experiment',
      label: exp.filename.replace(/\.json$/i, ''),
      path: exp.path,
    });
  }
  for (const sub of dir.subdirs.values()) {
    flattenExperiments(sub, out);
  }
}

/**
 * Build a hierarchical tree of folders and experiments from a flat list of file paths.
 *
 * @param paths - Array of file path strings from aa_index.json experiments list
 * @returns Array of TreeNode objects representing the folder hierarchy
 */
export function buildExperimentTree(paths: string[]): TreeNode[] {
  const root = newRawDir();

  for (const path of paths) {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const dirParts = parts.slice(0, -1);

    // Walk/create directory structure
    let current = root;
    for (const part of dirParts) {
      if (!current.subdirs.has(part)) {
        current.subdirs.set(part, newRawDir());
      }
      current = current.subdirs.get(part)!;
    }

    current.experiments.push({ filename, path });
  }

  return convertDir(root);
}
