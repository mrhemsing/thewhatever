import fs from 'node:fs/promises';
import path from 'node:path';

type Candidate = {
  order: number;
  id: string;
  postUrl: string;
  imageUrl: string;
  caption: string;
  noteCount: number;
  date: string;
  tags: string[];
  reviewStatus: string;
};

type ReviewQueue = {
  candidates: Candidate[];
};

async function getReviewQueue(): Promise<Candidate[]> {
  const filePath = path.join(process.cwd(), '..', 'data', 'x-review-queue.json');
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ReviewQueue;
  return parsed.candidates ?? [];
}

function formatNotes(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

export default async function QueuePage() {
  const candidates = await getReviewQueue();

  return (
    <main className="queueWrap">
      <div className="queueTopbar">
        <div>
          <div className="queueEyebrow">@thewhatever</div>
          <h1>X review queue</h1>
          <p className="queueSub">First-pass candidate posts pulled from the archive. Next step is adding move/approve actions.</p>
        </div>
        <div className="queueStat">{candidates.length} candidates</div>
      </div>

      <section className="queueColumns">
        <div className="queueColumn">
          <div className="queueColumnHead">
            <h2>Inbox</h2>
            <span>{candidates.length}</span>
          </div>
          <div className="queueGrid">
            {candidates.map((item) => (
              <article key={item.id} className="queueCard">
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
                    <button className="queueButton" type="button" disabled>Approve</button>
                    <button className="queueButton ghost" type="button" disabled>Skip</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
