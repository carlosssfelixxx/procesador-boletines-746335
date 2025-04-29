const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const queueUrl = 'https://sqs.us-east-1.amazonaws.com/998275817831/colaBoletines';
const tableName = 'boletinesTable';
const topicArn = 'arn:aws:sns:us-east-1:998275817831:boletines-topic';

AWS.config.update({ region: 'us-east-1' });

const sqs = new AWS.SQS();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

function pollQueue() {
  sqs.receiveMessage({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
    VisibilityTimeout: 30
  }, async (err, data) => {
    if (err) return console.error('Error al recibir mensajes:', err);

    if (!data.Messages || data.Messages.length === 0) return pollQueue();

    const message = data.Messages[0];
    const receiptHandle = message.ReceiptHandle;

    try {
      const body = JSON.parse(message.Body);
      const boletinId = uuidv4();

      await dynamodb.put({
        TableName: tableName,
        Item: {
          id: boletinId,
          correo: body.correo,
          mensaje: body.mensaje,
          imagen: body.imagen,
          leido: false
        }
      }).promise();

      await sns.publish({
        TopicArn: topicArn,
        Subject: 'Nuevo boletín recibido',
        Message: `Tienes un nuevo boletín disponible.\n\nVer aquí: http://localhost:5000/boletines/${boletinId}?correoElectronico=${body.correo}`,
      }).promise();

      await sqs.deleteMessage({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle
      }).promise();

      console.log(`Boletín procesado y guardado: ${boletinId}`);
    } catch (err) {
      console.error('Error procesando mensaje:', err);
    }

    pollQueue();
  });
}

pollQueue();
