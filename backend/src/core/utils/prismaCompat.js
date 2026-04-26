export function isPrismaSchemaDriftError(error) {
  const code = error?.code;
  const message = String(error?.message || '');

  return (
    code === 'P2021' ||
    code === 'P2022' ||
    message.includes('does not exist in the current database') ||
    message.includes('The column') ||
    message.includes('The table')
  );
}

export function hasPrismaDelegate(client, delegateName) {
  return !!client?.[delegateName] && typeof client[delegateName] === 'object';
}
