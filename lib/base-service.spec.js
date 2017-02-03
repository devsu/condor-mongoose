const proxyquire = require('proxyquire');

describe('Service', () => {
  let Service, mongooseMock;

  describe('constructor()', () => {
    describe('when mongoose is not connected', () => {
      beforeEach(() => {
        mongooseMock = {
          'connection': {
            'readyState': 0, // disconnected
          },
        };
        Service = proxyquire('./base-service', {'mongoose': mongooseMock});
      });
      it('should throw an error', () => {
        expect(() => {
          /* eslint-disable no-new */
          new Service();
        }).toThrowError('mongoose is not connected');
      });
    });
  });
});
