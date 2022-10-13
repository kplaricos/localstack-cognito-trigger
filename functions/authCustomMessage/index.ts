import {
  CustomMessageTriggerEvent,
  CustomMessageTriggerHandler,
  Context,
} from 'aws-lambda';

export const handler: CustomMessageTriggerHandler = async (
  event: CustomMessageTriggerEvent,
  context: Context
) => {
  console.info(`EVENT: ${JSON.stringify(event)}`);

  if (event.triggerSource === 'CustomMessage_SignUp') {
    try {
      event.response.emailSubject = 'Welcome';
      event.response.emailMessage = 'Just for test';

      console.log('RESPONSE:', event.response);
      return event;
    } catch (err) {
      console.error(err);
      throw err;
    }
  } else {
    return event;
  }
};
