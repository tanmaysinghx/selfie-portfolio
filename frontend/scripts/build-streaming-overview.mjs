// Rebuild the article diagram from the official AWS 64px service SVG directory.
// Usage: node scripts/build-streaming-overview.mjs <icon-directory>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const iconDir = process.argv[2];
if (!iconDir) throw new Error('Pass the extracted AWS service icon directory.');
const out = new URL('../public/posts/design-streaming-platform-100-million/architecture-overview.svg', import.meta.url);
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1900" viewBox="0 0 1800 1900" role="img" aria-labelledby="title desc">
<title id="title">A streaming platform for 100 million viewers: complete AWS architecture</title>
<desc id="desc">Three paths: live and VOD media through CloudFront to players; regional ALB to Spring Boot on EKS and three data stores; Go ingestion through Kinesis to consumers and S3. Cognito, DRM, WAF, security, delivery and observability support these paths. Repeat regional cells with tested failover capacity.</desc>
<defs>${['media','api','event','support'].map((id,i)=>`<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${['#147d81','#7357bb','#bd6328','#69788c'][i]}"/></marker>`).join('')}</defs>
<rect width="1800" height="1900" fill="#f5f7fb"/>
<g font-family="Segoe UI,Arial,sans-serif">`];
function text(x,y,s,size=20,color='#25334a',weight=400) { parts.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(s)}</text>`); }
function panel(y,h,title,sub,color) {parts.push(`<rect x="35" y="${y}" width="1730" height="${h}" rx="18" fill="white" stroke="#d8e0eb"/>`);text(65,y+38,title,24,color,700);text(65,y+66,sub,17,'#617187');}
function edge(d,kind='api',dashed=false) {const colors={media:'#147d81',api:'#7357bb',event:'#bd6328',support:'#69788c'};parts.push(`<path d="${d}" fill="none" stroke="${colors[kind]}" stroke-width="2.5" ${dashed?'stroke-dasharray="7 5"':''} marker-end="url(#${kind})"/>`);}
function node(x,y,title,sub,icon,tag) {
 parts.push(`<rect x="${x}" y="${y}" width="270" height="115" rx="10" fill="#fff" stroke="#ced8e6"/>`);
 if(icon) {const raw=readFileSync(join(iconDir,`Arch_${icon}_64.svg`));parts.push(`<image x="${x+16}" y="${y+17}" width="48" height="48" href="data:image/svg+xml;base64,${raw.toString('base64')}"/>`);}
 else {parts.push(`<rect x="${x+16}" y="${y+17}" width="48" height="48" rx="10" fill="#e8eef5"/>`);text(x+24,y+49,tag||'▶',20,'#435a78',700);}
 text(x+76,y+37,title,18,'#25334a',600);
 text(x+16,y+89,sub,16,'#617187');
}
text(60,62,'THE WHOLE SYSTEM, IN ONE VIEW',17,'#7357bb',700);
text(60,110,'Designing for 100 million concurrent viewers',40,'#17263e',700);
text(60,143,'Proposed architecture • 200 Tbps at 2 Mbps/viewer • 25M video-segment requests/s at 4-second segments',19,'#617187');
panel(175,390,'01 / MEDIA DELIVERY','Solid teal arrows show media delivery. Players request cached objects directly from the CDN.','#147d81');
for(const x of [340,670,1000,1330]) edge(`M${x} 313H${x+60}`,'media');
edge('M340 463H400','media');edge('M670 463H730','media');edge('M1000 463H1040V350H1060','media');
node(70,255,'Live contribution','Redundant production feeds',null,'TV');
node(400,255,'MediaLive','Encode a bitrate ladder','AWS-Elemental-MediaLive');
node(730,255,'MediaPackage','Live packaging + origin','AWS-Elemental-MediaPackage');
node(1060,255,'CloudFront','CDN + delivery authorization','Amazon-CloudFront');
node(1390,255,'100M viewers','Adaptive player + local buffer',null,'▶');
node(70,405,'Source assets','VOD uploads / recordings','Amazon-Simple-Storage-Service');
node(400,405,'MediaConvert','Offline transcoding','AWS-Elemental-MediaConvert');
node(730,405,'S3 VOD origin','Private packaged media','Amazon-Simple-Storage-Service');
text(1090,432,'Plan CDN capacity and quotas.',20,'#147d81',600);
text(1090,465,'Origin shielding + tested alternate CDN;',18,'#617187');
text(1090,493,'a second provider is not drawn here.',18,'#617187');
panel(595,605,'02 / PLAYBACK & BUSINESS APIs','Logical serving cell: ALB ingress; private EKS workloads across AZs; managed data services. Repeat by cohort and region.','#7357bb');
for(const x of [340,670,1000]) edge(`M${x} 813H${x+60}`);
edge('M1330 813H1360V718H1390');edge('M1360 813V868H1390');edge('M1360 868V1018H1390');
edge('M205 870V980','support',true);edge('M250 870V945H535V980','support',true);
edge('M865 980V870','support',true);
node(70,755,'Same players','Browse / start / renew',null,'API');
node(400,755,'Route 53','DNS selects regional endpoint','Amazon-Route-53');
node(730,755,'Regional ALB','Routes requests to services','Elastic-Load-Balancing');
node(1060,755,'Amazon EKS','Java / Spring Boot services','Amazon-Elastic-Kubernetes-Service');
node(1390,660,'ElastiCache','Valkey: bounded read caches','Amazon-ElastiCache');
node(1390,810,'DynamoDB','Sessions + watch progress','Amazon-DynamoDB');
node(1390,960,'Aurora PostgreSQL','Catalogue + billing / outbox','Amazon-Aurora');
node(70,980,'Amazon Cognito','Sign-in / identity tokens','Amazon-Cognito');
node(400,980,'DRM provider','Protected-content licenses',null,'KEY');
node(730,980,'AWS WAF','Rules attached to the ALB','AWS-WAF');
text(1060,930,'Inside the EKS service boundary:',17,'#7357bb',600);
text(1060,961,'playback • entitlement',17,'#617187');
text(1060,989,'catalogue • billing',17,'#617187');
text(65,1141,'API responses return playback URLs and authorization; video bytes never pass through these services.',19,'#25334a',600);
text(65,1171,'Dashed arrows: player identity/license exchanges and WAF attachment. API data arrows: logical access, responses omitted.',17,'#617187');
panel(1230,245,'03 / ASYNCHRONOUS EVENTS','Same player → regional ALB ingress, then an independent ingestion workload. Example: 3.33M heartbeat events/s.','#bd6328');
for(const x of [340,670,1000,1330]) edge(`M${x} 1388H${x+60}`,'event');
node(70,1330,'Same regional ALB','Telemetry endpoint / batches','Elastic-Load-Balancing');
node(400,1330,'Go on EKS','Validate + bounded publishing','Amazon-Elastic-Kubernetes-Service');
node(730,1330,'Kinesis Data Streams','Durable partitioned ingestion','Amazon-Kinesis-Data-Streams');
node(1060,1330,'EKS consumers','Quality / progress / analytics','Amazon-Elastic-Kubernetes-Service');
node(1390,1330,'S3 analytics','Analytics output + retention','Amazon-Simple-Storage-Service');
panel(1505,240,'04 / SHARED OPERATIONS & SECURITY','Cross-cutting services, not a sequential request path. Scope permissions and capacity to each workload.','#435a78');
node(70,1600,'CloudWatch','Metrics / logs + OTel traces','Amazon-CloudWatch');
node(400,1600,'IAM','Scoped workload permissions','AWS-Identity-and-Access-Management');
node(730,1600,'Secrets Manager','Credentials and signing secrets','AWS-Secrets-Manager');
node(1060,1600,'AWS KMS','Encryption key management','AWS-Key-Management-Service');
node(1390,1600,'Amazon ECR','Versioned container images','Amazon-Elastic-Container-Registry');
text(60,1792,'REPEAT TESTED CELLS • RESERVE FAILOVER CAPACITY • PRE-SCALE BEFORE THE EVENT',23,'#17263e',700);
text(60,1827,'Secondary paths: SQS workers for retryable jobs; outbox events update entitlement projections; progress consumers write DynamoDB.',18,'#617187');
text(60,1856,'One icon represents a logical role, not one global instance. DNS is endpoint selection, not an HTTP proxy. DR and return paths are simplified.',17,'#617187');
text(60,1883,'Official AWS Architecture Icons, July 2026. Independent educational design; no AWS endorsement or measured 100M-viewer claim.',16,'#617187');
parts.push('</g></svg>');
writeFileSync(out,parts.join('\n'));
console.log('Built architecture-overview.svg');
