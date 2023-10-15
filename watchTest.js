/*
  watch.js
  Module for watching for a job and running it when found.
*/

// ########## IMPORTS

// Module to read and write files.
const fs = require('fs/promises');
// Module to make requests to servers.
const httpClient = require('http');
const httpsClient = require('https');

// CONSTANTS

const jobDir = process.env.JOBDIR;
const jobURLs = process.env.JOB_URLS;
const agent = process.env.AGENT;

// ########## FUNCTIONS

// Returns a string representing the date and time.
const nowString = () => (new Date()).toISOString().slice(0, 19);
// Waits.
const wait = ms => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve('');
    }, ms);
  });
};
// Serves an object in JSON format.
const serveObject = (object, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(object));
};
// Checks for a directory job and, if found, performs and reports it, once or repeatedly.
const checkDirJob = async (interval) => {
  try {
    // If there are any jobs to do in the watched directory:
    const toDoFileNames = await fs.readdir(`${jobDir}/todo`);
    const jobFileNames = toDoFileNames.filter(fileName => fileName.endsWith('.json'));
    if (jobFileNames.length) {
      // Get the first one.
      const jobJSON = await fs.readFile(`${jobDir}/todo/${jobFileNames[0]}`, 'utf8');
      try {
        const job = JSON.parse(jobJSON, null, 2);
        const {id} = job;
        // Perform it.
        console.log(`Directory job ${id} found (${nowString()})`);
        await doJob(job);
        console.log(`Job ${id} finished (${nowString()})`);
        // Report it.
        await writeDirReport(job);
        // Archive it.
        await archiveJob(job);
        console.log(`Job ${id} archived in ${jobDir} (${nowString()})`);
        // If watching is repetitive:
        if (interval > -1) {
          // Wait for the specified interval.
          await wait(1000 * interval);
          // Check the servers again.
          checkDirJob(interval);
        }
      }
      catch(error) {
        console.log(`ERROR processing directory job (${error.message})`);
      }
    }
    // Otherwise, i.e. if there are no more jobs to do in the watched directory:
    else {
      console.log(`No job to do in ${jobDir} (${nowString()})`);
      // If checking is repetitive:
      if (interval > -1) {
        // Wait for the specified interval.
        await wait(1000 * interval);
        // Check the directory again.
        await checkDirJob(interval);
      }
    }
  }
  catch(error) {
    console.log(`ERROR: Directory watching failed (${error.message})`);
  }
};
// Checks servers for a network job.
const checkNetJob = async (servers, serverIndex, isForever, interval, noJobCount) => {
  // If all servers are jobless:
  if (noJobCount === servers.length) {
    // Wait for the specified interval.
    await wait(1000 * interval);
    // Reset the count of jobless servers.
    noJobCount = 0;
  }
  // Otherwise, i.e. if any server may still have a job:
  else {
    // Wait 2 seconds.
    await wait(2000);
  }
  // Check the next server.
  serverIndex = serverIndex % servers.length;
  const server = servers[serverIndex];
  const client = server.startsWith('https://') ? httpsClient : httpClient;
  const fullURL = `${servers[serverIndex]}?agent=${agent}`;
  const logStart = `Requested job from server ${server} and got `;
  client.request(fullURL, response => {
    const chunks = [];
    response
    .on('error', error => {
      console.log(`${logStart}error message ${error.message}`);
    })
    .on('data', chunk => {
      chunks.push(chunk);
    })
    // When the response arrives:
    .on('end', async () => {
      const content = chunks.join('');
      try {
        // If the server sent a message:
        const contentObj = JSON.parse(content);
        const {message, id, sources} = contentObj;
        if (message) {
          // Report it.
          console.log(`${logStart}${message}`);
          // Check the next server.
          await checkNetJob(servers, serverIndex + 1, isForever, interval, noJobCount + 1);
        }
        // Otherwise, if the server sent a valid job:
        else if (id && sources) {
          const {sendReportTo} = sources;
          if (sendReportTo) {
            // Perform it.
            console.log(`${logStart}job ${id} for ${sendReportTo} (${nowString()})`);
            await doJob(contentObj);
            console.log(`Job ${id} finished (${nowString()})`);
            // If watching is to be repeated:
            if (isForever) {
              // Resume watching.
              await checkNetJob(servers, serverIndex + 1, true, interval, 0);
            }
            // Otherwise, i.e. if watching is to stop after 1 job is found:
            else {
              // Report its end and stop checking.
              console.log('Network watching ended after 1 job');
            }
          }
          // Otherwise, if the job specifies no report destination:
          else {
            // Report this.
            const message = `ERROR: ${logStart}job with no report destination`;
            serveObject(message);
            console.log(message);
            // Continue watching.
            await checkNetJob(servers, serverIndex + 1, isForever, interval, noJobCount + 1);
          }
        }
        // Otherwise, if the job has no ID or no sources property:
        else {
          // Report this.
          const message = `ERROR: ${logStart}invalid response`;
          serveObject(message);
          console.log(message);
          // Continue watching.
          await checkNetJob(servers, serverIndex + 1, isForever, interval, noJobCount + 1);
        }
      }
      // If processing the server response threw an error:
      catch(error) {
        // Report this.
        console.log(
          `ERROR: ${logStart}status ${response.statusCode}, error message ${error.message}, and response ${content.slice(0, 1000)}`
        );
        // Continue watching.
        await checkNetJob(servers, serverIndex + 1, isForever, interval, noJobCount + 1);
      }
    })
  })
  // If the request threw an error:
  .on('error', async error => {
    // Report this.
    console.log(`ERROR: ${logStart}error message ${error.message}`);
    // Continue watching.
    await checkNetJob(servers, serverIndex + 1, isForever, interval, noJobCount + 1);
  })
  .end();
};
// Composes an interval description.
const intervalSpec = interval => {
  if (interval > -1) {
    return `repeatedly, with ${interval}-second intervals `;
  }
  else {
    return '';
  }
};
// Checks for a directory job, performs it, and submits a report, once or repeatedly.
exports.dirWatch = async (interval = 300) => {
  console.log(`Directory watching started ${intervalSpec(interval)}(${nowString()})\n`);
  // Start the checking.
  await checkDirJob(interval);
};
// Checks for a network job, performs it, and submits a report, once or repeatedly.
exports.netWatch = async (isForever, interval = 300) => {
  // If the servers to be checked are valid:
  const servers = jobURLs
  .split('+')
  .map(url => [Math.random(), url])
  .sort((a, b) => a[0] - b[0])
  .map(pair => pair[1]);
  if (
    servers
    && servers.length
    && servers
    .every(server => ['http://', 'https://'].some(prefix => server.startsWith(prefix)))
  ) {
    console.log(`Network watching started ${intervalSpec(interval)}(${nowString()})\n`);
    // Start checking.
    await checkNetJob(servers, 0, isForever, interval, 0);
  }
  else {
    console.log('ERROR: List of job URLs invalid');
  }
};