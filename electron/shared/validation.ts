// 中文注释：项目名称等输入校验。主进程是校验的唯一执行点，
// 渲染进程传来的名称与路径一律在这里检查后才进入业务层。

import { PROJECT_NAME_MAX_LENGTH } from './project-types.js';

// 中文注释：Windows/macOS/Linux 三平台都不允许的路径字符并集。
// Windows 保留 <>:"/\|?* 与控制字符，macOS 还保留冒号，Linux 保留斜杠与 NUL。
const ILLEGAL_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

// 中文注释：Windows 保留设备名（CON、PRN、AUX、NUL、COM1-9、LPT1-9），
// 即使带扩展名也不允许作为目录名，这里统一拒绝以覆盖 Windows 用户的场景。
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// 中文注释：Windows 不允许目录名以点或空格结尾，这里提前拦截避免复制后无法访问。
const TRAILING_DOT_OR_SPACE = /[. ]$/;

/**
 * 校验并规范化项目名称。
 * 返回去除首尾空格后的名称；不合法时抛出带中文提示的错误。
 */
export function assertValidProjectName(rawName: string): string {
  const name = rawName.trim();
  if (name.length === 0) {
    throw new Error('项目名称不能为空');
  }
  if (name.length > PROJECT_NAME_MAX_LENGTH) {
    throw new Error(`项目名称不能超过 ${PROJECT_NAME_MAX_LENGTH} 个字符`);
  }
  if (ILLEGAL_NAME_CHARS.test(name)) {
    throw new Error('项目名称包含不允许的路径字符（<>:"/\\|?*）');
  }
  if (RESERVED_NAMES.test(name)) {
    throw new Error('项目名称是系统保留名称，请更换名称');
  }
  if (TRAILING_DOT_OR_SPACE.test(name)) {
    throw new Error('项目名称不能以点或空格结尾');
  }
  return name;
}
