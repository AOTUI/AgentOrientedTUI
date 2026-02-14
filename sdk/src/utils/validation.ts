/**
 * AOTUI SDK - Validation Utilities
 *
 * 校验函数确保命名符合 AOTUI 约定
 */

/**
 * 校验 Operation Name 是否符合 snake_case 约定
 *
 * 规则:
 * - 必须以小写字母开头
 * - 只能包含小写字母、数字和下划线
 * - 不能包含连字符 (连字符保留给路径分隔符)
 *
 * @example
 * validateOperationName('send_message') // true
 * validateOperationName('get_user_info') // true
 * validateOperationName('SendMessage') // false
 * validateOperationName('get-user') // false
 */
export function validateOperationName(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/**
 * 校验 App ID 格式
 *
 * 规则: app_N (N 为数字)
 */
export function validateAppId(id: string): boolean {
  return /^app_\d+$/.test(id);
}

/**
 * 校验 View ID 格式
 *
 * 规则: view_N (N 为数字)
 */
export function validateViewId(id: string): boolean {
  return /^view_\d+$/.test(id);
}

/**
 * 校验 Function Name (Tool Name) 格式
 *
 * 规则: {app_id}-{view_id}-{operation_id}
 * 或: system-{operation_id}
 */
export function validateFunctionName(name: string): boolean {
  // 系统命令
  if (name.startsWith("system-")) {
    const op = name.slice(7);
    return validateOperationName(op);
  }

  // 应用操作
  const parts = name.split("-");
  if (parts.length !== 3) return false;

  return (
    validateAppId(parts[0]) &&
    validateViewId(parts[1]) &&
    validateOperationName(parts[2])
  );
}

/**
 * 断言 Operation Name 有效,无效则抛出错误
 */
export function assertValidOperationName(name: string, context?: string): void {
  if (!validateOperationName(name)) {
    const msg = context
      ? `Invalid operation name "${name}" in ${context}. Must be snake_case (e.g. send_message).`
      : `Invalid operation name "${name}". Must be snake_case (e.g. send_message).`;
    throw new Error(msg);
  }
}
