import { groupQueueItems, loadQueueState, type QueueItem, type QueueStatus } from '@/lib/xQueue';
import { updateQueueItemStatus } from './actions';

function formatNotes(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

function QueueCard({ item, primary, secondary }: { item: QueueItem; primary?: QueueStatus; secondary?: QueueStatus }) {
  return (
    <article className="queueCard">
      <img className="queueImage" src={item.imageUrl} alt="" />
      <div className="queueBody">
        <div className="queueMetaRow">
          <span className="queueBadge">#{item.order}</span>
          <span className="queueMuted">{formatNotes(item.noteCount)} notes</span>
        </div>
        <p className="queueCaption">{item.caption}</p>
        <div className="queueMetaBlock">
          <div><strong>ID:</strong> {item.id}</div>
          <div><strong>Date:</strong> {item.date}</div>
          {item.tags?.length ? <div><strong>Tags:</strong> {item.tags.join(', ')}</div> : null}
        </div>
        <div className="queueActions">
          <a className="queueLink" href={item.postUrl} target="_blank" rel="noopener noreferrer">Open original</a>
          {primary ? (
            <form action={updateQueueItemStatus}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value={primary} />
              <button className="queueButton" type="submit">{labelForStatus(primary)}</button>
            </form>
          ) : null}
          {secondary ? (
            <form action={updateQueueItemStatus}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value={secondary} />
              <button className="queueButton ghost" type="submit">{labelForStatus(secondary)}</button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function labelForStatus(status: QueueStatus) {
  switch (status) {
    case 'approved': return 'Approve';
    case 'rejected': return 'Reject';
    case 'posted': return 'Mark posted';
    case 'inbox': return 'Move to inbox';
  }
}

export default async function QueuePage() {
  const state = await loadQueueState();
  const groups = groupQueueItems(state.items);

  return (
    <main className="queueWrap">
      <div className="queueTopbar">
        <div>
          <div className="queueEyebrow">@thewhatever</div>
          <h1>X review queue</h1>
          <p className="queueSub">Now stateful: move posts between inbox, approved, posted, and rejected.</p>
        </div>
        <div className="queueStat">{state.items.length} total items</div>
      </div>

      <section className="queueColumnsGrid">
        <div className="queueColumn">
          <div className="queueColumnHead"><h2>Inbox</h2><span>{groups.inbox.length}</span></div>
          <div className="queueGrid">
            {groups.inbox.map((item) => <QueueCard key={item.id} item={item} primary="approved" secondary="rejected" />)}
          </div>
        </div>

        <div className="queueColumn">
          <div className="queueColumnHead"><h2>Approved</h2><span>{groups.approved.length}</span></div>
          <div className="queueGrid">
            {groups.approved.map((item) => <QueueCard key={item.id} item={item} primary="posted" secondary="inbox" />)}
          </div>
        </div>

        <div className="queueColumn">
          <div className="queueColumnHead"><h2>Posted</h2><span>{groups.posted.length}</span></div>
          <div className="queueGrid">
            {groups.posted.map((item) => <QueueCard key={item.id} item={item} primary="inbox" secondary="rejected" />)}
          </div>
        </div>

        <div className="queueColumn">
          <div className="queueColumnHead"><h2>Rejected</h2><span>{groups.rejected.length}</span></div>
          <div className="queueGrid">
            {groups.rejected.map((item) => <QueueCard key={item.id} item={item} primary="inbox" />)}
          </div>
        </div>
      </section>
    </main>
  );
}
