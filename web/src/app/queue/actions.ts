'use server';

import { revalidatePath } from 'next/cache';
import { moveQueueItem, type QueueStatus } from '@/lib/xQueue';

export async function updateQueueItemStatus(formData: FormData) {
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as QueueStatus;
  if (!id) return;
  if (!['inbox', 'approved', 'posted', 'rejected'].includes(status)) return;
  await moveQueueItem(id, status);
  revalidatePath('/queue');
}
